"""Benchmark inference speed for baseline and improved YOLO models."""

from __future__ import annotations

import argparse
import csv
import json
import statistics
import sys
import time
from pathlib import Path

import yaml
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from custom_yolo import apply_yolov8_patches

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def parse_args():
    parser = argparse.ArgumentParser(description="Benchmark inference speed for two YOLO checkpoints.")
    parser.add_argument("--baseline-weights", type=Path, required=True)
    parser.add_argument("--improved-weights", type=Path, required=True)
    parser.add_argument("--source", type=Path, default=ROOT / "datasets" / "rotten_grade_det_4c" / "images" / "test")
    parser.add_argument("--data", type=Path, default=ROOT / "datasets" / "rotten_grade_det_4c" / "data.yaml")
    parser.add_argument("--imgsz", type=int, default=640)
    parser.add_argument("--conf", type=float, default=0.25)
    parser.add_argument("--device", type=str, default="cpu")
    parser.add_argument("--warmup", type=int, default=5)
    parser.add_argument("--max-images", type=int, default=50)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "outputs" / "speed_benchmark")
    return parser.parse_args()


def load_class_count(data_yaml: Path) -> int:
    data = yaml.safe_load(data_yaml.read_text(encoding="utf-8")) or {}
    names = data.get("names", [])
    if isinstance(names, dict):
        return len(names)
    return len(names) if names else 4


def collect_images(source: Path, max_images: int) -> list[Path]:
    if source.is_file():
        return [source]
    images = sorted([p for p in source.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES])
    return images[:max_images] if max_images > 0 else images


def run_once(model: YOLO, image_path: Path, imgsz: int, conf: float, device: str):
    results = model.predict(
        source=str(image_path),
        imgsz=imgsz,
        conf=conf,
        device=device,
        save=False,
        verbose=False,
    )
    if not results:
        raise RuntimeError(f"No prediction results for {image_path}")
    return results[0]


def benchmark_model(model_name: str, weights: Path, image_paths: list[Path], imgsz: int, conf: float, device: str, warmup: int):
    model = YOLO(str(weights))

    warmup_images = image_paths[: min(warmup, len(image_paths))]
    for image_path in warmup_images:
        run_once(model, image_path, imgsz, conf, device)

    rows = []
    total_start = time.perf_counter()
    for image_path in image_paths:
        start = time.perf_counter()
        result = run_once(model, image_path, imgsz, conf, device)
        end = time.perf_counter()
        speeds = getattr(result, "speed", {}) or {}
        rows.append(
            {
                "image": image_path.name,
                "wall_ms": (end - start) * 1000.0,
                "preprocess_ms": float(speeds.get("preprocess", 0.0)),
                "inference_ms": float(speeds.get("inference", 0.0)),
                "postprocess_ms": float(speeds.get("postprocess", 0.0)),
            }
        )
    total_end = time.perf_counter()

    wall_values = [row["wall_ms"] for row in rows]
    preprocess_values = [row["preprocess_ms"] for row in rows]
    inference_values = [row["inference_ms"] for row in rows]
    postprocess_values = [row["postprocess_ms"] for row in rows]
    total_ms = (total_end - total_start) * 1000.0
    avg_wall = statistics.mean(wall_values)

    return {
        "model": model_name,
        "weights": str(weights),
        "image_count": len(rows),
        "total_wall_ms": round(total_ms, 3),
        "avg_wall_ms_per_image": round(avg_wall, 3),
        "fps_by_wall": round(1000.0 / avg_wall, 3) if avg_wall > 0 else 0.0,
        "avg_preprocess_ms": round(statistics.mean(preprocess_values), 3),
        "avg_inference_ms": round(statistics.mean(inference_values), 3),
        "avg_postprocess_ms": round(statistics.mean(postprocess_values), 3),
        "details": rows,
    }


def main():
    args = parse_args()
    for path in (args.baseline_weights, args.improved_weights, args.data):
        if not path.exists():
            raise FileNotFoundError(path)

    image_paths = collect_images(args.source, args.max_images)
    if not image_paths:
        raise RuntimeError(f"No images found under {args.source}")

    class_count = load_class_count(args.data)
    apply_yolov8_patches([1.0] * class_count)

    baseline = benchmark_model(
        model_name="baseline_yolov8n",
        weights=args.baseline_weights,
        image_paths=image_paths,
        imgsz=args.imgsz,
        conf=args.conf,
        device=args.device,
        warmup=args.warmup,
    )
    improved = benchmark_model(
        model_name="improved_yolov8n",
        weights=args.improved_weights,
        image_paths=image_paths,
        imgsz=args.imgsz,
        conf=args.conf,
        device=args.device,
        warmup=args.warmup,
    )

    output_dir = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    summary = {
        "device": args.device,
        "imgsz": args.imgsz,
        "conf": args.conf,
        "source": str(args.source),
        "image_count": len(image_paths),
        "baseline": baseline,
        "improved": improved,
    }

    json_path = output_dir / "speed_benchmark_summary.json"
    json_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    csv_path = output_dir / "speed_benchmark_summary.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=[
                "model",
                "image_count",
                "avg_wall_ms_per_image",
                "fps_by_wall",
                "avg_preprocess_ms",
                "avg_inference_ms",
                "avg_postprocess_ms",
                "weights",
            ],
        )
        writer.writeheader()
        for item in (baseline, improved):
            writer.writerow(
                {
                    "model": item["model"],
                    "image_count": item["image_count"],
                    "avg_wall_ms_per_image": item["avg_wall_ms_per_image"],
                    "fps_by_wall": item["fps_by_wall"],
                    "avg_preprocess_ms": item["avg_preprocess_ms"],
                    "avg_inference_ms": item["avg_inference_ms"],
                    "avg_postprocess_ms": item["avg_postprocess_ms"],
                    "weights": item["weights"],
                }
            )

    print(f"Saved benchmark summary to: {json_path}")
    print(f"Saved benchmark CSV to: {csv_path}")


if __name__ == "__main__":
    main()
