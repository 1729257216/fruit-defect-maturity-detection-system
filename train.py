"""Train a lightweight YOLOv8 rotten-grade detector on a standard YOLO detection dataset."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
import yaml
from ultralytics import YOLO

from custom_yolo import apply_yolov8_patches

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = ROOT / 'datasets' / 'rotten_grade_det_4c' / 'data.yaml'
DEFAULT_PROJECT = ROOT / 'runs' / 'rotten_grade_yolov8n_lite'
DEFAULT_MODEL_CFG = ROOT / 'configs' / 'yolov8n_rotten_grade_lite_4c.yaml'


def parse_args():
    parser = argparse.ArgumentParser(description='Train lightweight YOLOv8 for rotten-grade detection.')
    parser.add_argument('--data', type=Path, default=DEFAULT_DATA, help='Path to detection data.yaml')
    parser.add_argument('--model-cfg', type=Path, default=DEFAULT_MODEL_CFG, help='Detection model yaml with the chosen number of classes')
    parser.add_argument('--project', type=Path, default=DEFAULT_PROJECT, help='Ultralytics run output directory')
    parser.add_argument('--name', type=str, default='exp', help='Run name under project directory')
    parser.add_argument('--epochs', type=int, default=50, help='Training epochs')
    parser.add_argument('--batch', type=int, default=8, help='Batch size')
    parser.add_argument('--imgsz', type=int, default=640, help='Image size')
    parser.add_argument('--workers', type=int, default=4, help='Data loader workers')
    parser.add_argument('--device', type=str, default='', help='CUDA device id such as 0, or cpu')
    parser.add_argument('--seed', type=int, default=42, help='Random seed')
    parser.add_argument('--pretrained', type=str, default='yolov8n.pt', help='Pretrained weight path or model name')
    parser.add_argument('--cache', type=str, default='disk', help='Use ram/disk cache, or False to disable')
    parser.add_argument('--class-weights', type=str, default='', help='Optional comma-separated class weights, e.g. 1.0,1.1,1.25,1.4')
    return parser.parse_args()


def count_params(model) -> int:
    return sum(p.numel() for p in model.parameters())


def metrics_to_dict(metrics) -> dict:
    if hasattr(metrics, 'results_dict'):
        return dict(metrics.results_dict)
    return {}


def str_to_cache_value(raw: str):
    lowered = str(raw).lower()
    if lowered == 'false':
        return False
    if lowered == 'true':
        return True
    return raw


def load_data_yaml(data_yaml: Path) -> dict:
    data = yaml.safe_load(data_yaml.read_text(encoding='utf-8')) or {}
    if 'names' not in data:
        raise ValueError(f'Data yaml missing names: {data_yaml}')
    return data


def load_model_yaml(model_yaml: Path) -> dict:
    return yaml.safe_load(model_yaml.read_text(encoding='utf-8')) or {}


def parse_class_weights(raw: str, class_count: int):
    if not raw.strip():
        return [1.0] * class_count
    values = [float(part.strip()) for part in raw.split(',') if part.strip()]
    if len(values) != class_count:
        raise ValueError(f'class-weights expects {class_count} values, got {len(values)}')
    return values


def has_split(data_yaml: Path, split_name: str) -> bool:
    data = load_data_yaml(data_yaml)
    return bool(data.get(split_name))


def main():
    args = parse_args()
    if not args.data.exists():
        raise FileNotFoundError(f'Data yaml not found: {args.data}')
    if not args.model_cfg.exists():
        raise FileNotFoundError(f'Model config not found: {args.model_cfg}')

    data_meta = load_data_yaml(args.data)
    class_names = data_meta['names']
    if isinstance(class_names, dict):
        class_names = [class_names[k] for k in sorted(class_names)]
    class_count = len(class_names)

    model_meta = load_model_yaml(args.model_cfg)
    model_nc = int(model_meta.get('nc', class_count))
    if model_nc != class_count:
        raise ValueError(
            f'Model nc={model_nc} does not match data.yaml names={class_count}. '
            f'Update {args.model_cfg.name} before training.'
        )

    class_weights = parse_class_weights(args.class_weights, class_count)
    apply_yolov8_patches(class_weights)

    baseline = YOLO('yolov8n.yaml')
    model = YOLO(str(args.model_cfg))
    baseline_params = count_params(baseline.model)
    custom_params = count_params(model.model)

    if args.pretrained:
        model.load(args.pretrained)

    cache_value = str_to_cache_value(args.cache)
    train_results = model.train(
        data=str(args.data),
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        project=str(args.project),
        name=args.name,
        device=args.device,
        workers=args.workers,
        seed=args.seed,
        patience=20,
        deterministic=True,
        optimizer='SGD',
        lr0=0.01,
        lrf=0.01,
        momentum=0.937,
        weight_decay=5e-4,
        warmup_epochs=3.0,
        hsv_h=0.015,
        hsv_s=0.5,
        hsv_v=0.35,
        degrees=5.0,
        translate=0.05,
        scale=0.10,
        shear=0.0,
        perspective=0.0,
        fliplr=0.5,
        flipud=0.0,
        mosaic=0.0,
        mixup=0.0,
        copy_paste=0.0,
        cache=cache_value,
        exist_ok=True,
        verbose=True,
        amp=torch.cuda.is_available(),
    )

    save_dir = Path(model.trainer.save_dir)
    best_pt = Path(model.trainer.best)
    best_model = YOLO(str(best_pt))

    val_metrics = best_model.val(
        data=str(args.data),
        split='val',
        imgsz=args.imgsz,
        batch=args.batch,
        device=args.device,
    )

    summary = {
        'task': 'detect',
        'class_names': class_names,
        'class_weights': class_weights,
        'training': {
            'epochs': args.epochs,
            'batch': args.batch,
            'imgsz': args.imgsz,
            'device': args.device or 'auto',
            'data': str(args.data),
            'model_cfg': str(args.model_cfg),
            'pretrained': args.pretrained,
            'save_dir': str(save_dir),
            'best_pt': str(best_pt),
            'has_test_split': has_split(args.data, 'test'),
        },
        'parameter_count': {
            'yolov8n_baseline': baseline_params,
            'yolov8n_rotten_grade_lite': custom_params,
            'reduction': baseline_params - custom_params,
            'reduction_ratio': round((baseline_params - custom_params) / baseline_params, 6),
        },
        'metrics': {
            'train': metrics_to_dict(train_results),
            'val': metrics_to_dict(val_metrics),
        },
    }

    if summary['training']['has_test_split']:
        test_metrics = best_model.val(
            data=str(args.data),
            split='test',
            imgsz=args.imgsz,
            batch=args.batch,
            device=args.device,
        )
        summary['metrics']['test'] = metrics_to_dict(test_metrics)

    summary_path = save_dir / 'rotten_grade_training_summary.json'
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding='utf-8')

    print('Training complete.')
    print(f'Best model: {best_pt}')
    print(f'Run directory: {save_dir}')
    print(f'Summary JSON: {summary_path}')


if __name__ == '__main__':
    main()
