"""Custom modules for lightweight rotten-grade detection on top of Ultralytics YOLOv8."""

from .layers import C2fLite
from .patches import apply_yolov8_patches

__all__ = [
    "C2fLite",
    "apply_yolov8_patches",
]
