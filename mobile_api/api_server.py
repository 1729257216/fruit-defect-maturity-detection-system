"""FastAPI server that exposes the YOLO detector to the showcase website."""

from __future__ import annotations

import base64
import os
import time
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple

import cv2
import numpy as np
import torch
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from ultralytics import YOLO
from ultralytics.nn.tasks import DetectionModel

ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = ROOT / "mobile_api" / "web"
DEFAULT_WEIGHTS = ROOT / "runs" / "baseline_compare" / "baseline_yolov8n_original" / "weights" / "best.pt"
DEFAULT_CLASSES = ["unripe", "ripe", "slight_rotten", "severe_rotten"]
CLASS_SEVERITY = {
    "unripe": 0,
    "ripe": 1,
    "slight_rotten": 2,
    "severe_rotten": 3,
}
DEFAULT_ALLOWED_ORIGINS = "*"


class BoundingBox(BaseModel):
    x1: float = Field(..., description="Left coordinate in pixels.")
    y1: float = Field(..., description="Top coordinate in pixels.")
    x2: float = Field(..., description="Right coordinate in pixels.")
    y2: float = Field(..., description="Bottom coordinate in pixels.")


class DetectionItem(BaseModel):
    class_id: int
    class_name: str
    confidence: float
    severity_rank: int
    box: BoundingBox


class DetectionSummary(BaseModel):
    detection_count: int
    class_counts: Dict[str, int]
    contains_rotten: bool
    highest_severity_class: Optional[str]
    primary_class: Optional[str]


class PredictResponse(BaseModel):
    filename: str
    width: int
    height: int
    confidence_threshold: float
    image_size: int
    elapsed_ms: int
    summary: DetectionSummary
    detections: List[DetectionItem]
    annotated_image_base64: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["ok"]
    model_weights: str
    model_available: bool
    docs_url: str


def resolve_weights_path() -> Path:
    configured = os.getenv("MANGO_MODEL_WEIGHTS", "").strip()
    weights = Path(configured) if configured else DEFAULT_WEIGHTS
    if not weights.is_absolute():
        weights = ROOT / weights
    return weights.resolve()


def resolve_allowed_origins() -> List[str]:
    configured = os.getenv("MANGO_API_ALLOW_ORIGINS", DEFAULT_ALLOWED_ORIGINS)
    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    return origins or ["*"]


def ordered_default_classes() -> List[str]:
    return list(DEFAULT_CLASSES)


@lru_cache(maxsize=2)
def load_model(weights_path: str) -> YOLO:
    # PyTorch 2.6 defaults torch.load(..., weights_only=True), which breaks
    # legacy Ultralytics checkpoints unless we opt out or allowlist the model.
    os.environ.setdefault("TORCH_FORCE_NO_WEIGHTS_ONLY_LOAD", "1")
    if hasattr(torch.serialization, "add_safe_globals"):
        torch.serialization.add_safe_globals([DetectionModel])
    return YOLO(weights_path)


def encode_annotated_image(result) -> str:
    plotted = result.plot(labels=True, conf=True)
    ok, encoded = cv2.imencode(".jpg", plotted, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to encode annotated image.")
    return base64.b64encode(encoded.tobytes()).decode("ascii")


def build_summary(result) -> Tuple[List[DetectionItem], DetectionSummary]:
    boxes = getattr(result, "boxes", None)
    names = getattr(result, "names", {}) or {}
    detections: List[DetectionItem] = []
    class_counts: Counter[str] = Counter()

    if boxes is not None and boxes.cls is not None:
        classes = boxes.cls.tolist()
        confidences = boxes.conf.tolist() if boxes.conf is not None else []
        coordinates = boxes.xyxy.tolist() if boxes.xyxy is not None else []

        for index, class_id in enumerate(classes):
            class_id = int(class_id)
            class_name = names.get(class_id, str(class_id)) if isinstance(names, dict) else str(class_id)
            confidence = float(confidences[index]) if index < len(confidences) else 0.0
            xyxy = coordinates[index] if index < len(coordinates) else [0.0, 0.0, 0.0, 0.0]
            severity_rank = CLASS_SEVERITY.get(class_name, -1)

            detections.append(
                DetectionItem(
                    class_id=class_id,
                    class_name=class_name,
                    confidence=round(confidence, 4),
                    severity_rank=severity_rank,
                    box=BoundingBox(
                        x1=round(float(xyxy[0]), 2),
                        y1=round(float(xyxy[1]), 2),
                        x2=round(float(xyxy[2]), 2),
                        y2=round(float(xyxy[3]), 2),
                    ),
                )
            )
            class_counts[class_name] += 1

    detections.sort(key=lambda item: (item.severity_rank, item.confidence), reverse=True)

    highest = detections[0].class_name if detections else None
    primary = max(detections, key=lambda item: item.confidence).class_name if detections else None
    contains_rotten = any(item.severity_rank >= CLASS_SEVERITY["slight_rotten"] for item in detections)

    summary = DetectionSummary(
        detection_count=len(detections),
        class_counts=dict(sorted(class_counts.items())),
        contains_rotten=contains_rotten,
        highest_severity_class=highest,
        primary_class=primary,
    )
    return detections, summary


app = FastAPI(
    title="Mango Quality Showcase API",
    version="1.0.0",
    description="Upload a mango image and receive detections plus an annotated preview for the web showcase.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=resolve_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if WEB_DIR.exists():
    app.mount("/demo-assets", StaticFiles(directory=WEB_DIR), name="demo-assets")


@app.get("/", tags=["meta"])
def index() -> RedirectResponse:
    return RedirectResponse(url="/demo", status_code=307)


@app.get("/demo", tags=["meta"])
def demo() -> FileResponse:
    demo_path = WEB_DIR / "index.html"
    if not demo_path.exists():
        raise HTTPException(status_code=404, detail="Demo UI files are missing.")
    return FileResponse(demo_path)


@app.get("/guide", tags=["meta"])
def guide() -> FileResponse:
    guide_path = WEB_DIR / "guide.html"
    if not guide_path.exists():
        raise HTTPException(status_code=404, detail="Guide UI files are missing.")
    return FileResponse(guide_path)


@app.get("/api/v1/meta", tags=["meta"])
def api_meta() -> Dict[str, str]:
    return {
        "message": "Mango Quality Showcase API is running.",
        "demo": "/demo",
        "guide": "/guide",
        "health": "/health",
        "predict": "/api/v1/predict",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse, tags=["meta"])
def health() -> HealthResponse:
    weights = resolve_weights_path()
    return HealthResponse(
        status="ok",
        model_weights=str(weights),
        model_available=weights.exists(),
        docs_url="/docs",
    )


@app.get("/api/v1/classes", tags=["meta"])
def classes() -> Dict[str, List[str]]:
    weights = resolve_weights_path()
    if not weights.exists():
        return {"classes": ordered_default_classes()}

    try:
        model = load_model(str(weights))
        names = getattr(model, "names", None) or {}
        if isinstance(names, dict):
            return {"classes": [str(names[index]) for index in sorted(names)]}
        if isinstance(names, list):
            return {"classes": [str(name) for name in names]}
    except Exception:
        pass

    return {"classes": ordered_default_classes()}


@app.post("/api/v1/predict", response_model=PredictResponse, tags=["predict"])
async def predict(
    image: UploadFile = File(..., description="JPEG or PNG image."),
    conf: float = Query(default=0.25, ge=0.01, le=0.95),
    imgsz: int = Query(default=640, ge=320, le=1280),
    return_annotated: bool = Query(default=True),
    device: str = Query(default="", description="Optional inference device, e.g. 0 or cpu."),
) -> PredictResponse:
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported.")

    weights = resolve_weights_path()
    if not weights.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Model checkpoint not found: {weights}. Set MANGO_MODEL_WEIGHTS before starting the server.",
        )

    content = await image.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    np_bytes = np.frombuffer(content, dtype=np.uint8)
    decoded = cv2.imdecode(np_bytes, cv2.IMREAD_COLOR)
    if decoded is None:
        raise HTTPException(status_code=400, detail="Failed to decode the uploaded image.")

    filename = image.filename or "upload.jpg"
    started = time.perf_counter()

    model = load_model(str(weights))
    results = model.predict(
        source=decoded,
        imgsz=imgsz,
        conf=conf,
        device=device or os.getenv("MANGO_INFER_DEVICE", ""),
        verbose=False,
        save=False,
    )

    if not results:
        raise HTTPException(status_code=500, detail="Model did not return any prediction result.")

    result = results[0]
    detections, summary = build_summary(result)
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    height, width = decoded.shape[:2]

    return PredictResponse(
        filename=filename,
        width=int(width),
        height=int(height),
        confidence_threshold=conf,
        image_size=imgsz,
        elapsed_ms=elapsed_ms,
        summary=summary,
        detections=detections,
        annotated_image_base64=encode_annotated_image(result) if return_annotated else None,
    )
