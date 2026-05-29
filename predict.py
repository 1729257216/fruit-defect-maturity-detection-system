"""Run inference with the rotten-grade YOLO detector and save a compact prediction summary."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

from ultralytics import YOLO

ROOT = Path(__file__).resolve().parent
DEFAULT_WEIGHTS = ROOT / 'runs' / 'baseline_compare' / 'baseline_yolov8n_original' / 'weights' / 'best.pt'
DEFAULT_PROJECT = ROOT / 'outputs' / 'predict'


def parse_args():
    parser = argparse.ArgumentParser(description='Run inference with the trained rotten-grade detector.')
    parser.add_argument('--weights', type=Path, default=DEFAULT_WEIGHTS, help='Path to a trained YOLO checkpoint.')
    parser.add_argument('--source', type=str, required=True, help='Image, folder, video, or webcam source.')
    parser.add_argument('--project', type=Path, default=DEFAULT_PROJECT, help='Prediction output directory.')
    parser.add_argument('--name', type=str, default='exp', help='Run name inside the output directory.')
    parser.add_argument('--imgsz', type=int, default=640, help='Inference image size.')
    parser.add_argument('--conf', type=float, default=0.25, help='Confidence threshold.')
    parser.add_argument('--device', type=str, default='', help='CUDA device such as 0, or cpu.')
    parser.add_argument('--save-txt', action='store_true', help='Save YOLO txt predictions.')
    parser.add_argument('--save-conf', action='store_true', help='Save confidence scores in txt output.')
    return parser.parse_args()


def summarize_results(results):
    overall_counts = Counter()
    image_summaries = []

    for result in results:
        per_image_counts = Counter()
        boxes = getattr(result, 'boxes', None)
        names = getattr(result, 'names', {}) or {}
        if boxes is not None and boxes.cls is not None:
            for class_id in boxes.cls.tolist():
                class_id = int(class_id)
                class_name = names.get(class_id, str(class_id)) if isinstance(names, dict) else str(class_id)
                per_image_counts[class_name] += 1
                overall_counts[class_name] += 1

        image_summaries.append(
            {
                'image': Path(result.path).name,
                'detection_count': int(sum(per_image_counts.values())),
                'class_counts': dict(sorted(per_image_counts.items())),
            }
        )

    return {
        'image_count': len(image_summaries),
        'overall_detection_count': int(sum(overall_counts.values())),
        'overall_class_counts': dict(sorted(overall_counts.items())),
        'images': image_summaries,
    }


def main():
    args = parse_args()
    if not args.weights.exists():
        raise FileNotFoundError(f'Checkpoint not found: {args.weights}')

    model = YOLO(str(args.weights))
    results = model.predict(
        source=args.source,
        imgsz=args.imgsz,
        conf=args.conf,
        device=args.device,
        project=str(args.project),
        name=args.name,
        exist_ok=True,
        save=True,
        save_txt=args.save_txt,
        save_conf=args.save_conf,
        verbose=True,
    )

    save_dir = Path(model.predictor.save_dir)
    summary = {
        'weights': str(args.weights),
        'source': args.source,
        'imgsz': args.imgsz,
        'conf': args.conf,
        'device': args.device or 'auto',
        'save_dir': str(save_dir),
        'results': summarize_results(results),
    }
    summary_path = save_dir / 'prediction_summary.json'
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')

    print(f'Prediction complete. Results saved to: {save_dir}')
    print(f'Summary JSON: {summary_path}')


if __name__ == '__main__':
    main()
