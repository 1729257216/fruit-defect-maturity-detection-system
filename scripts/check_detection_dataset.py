"""Validate a YOLO detection dataset and report class distribution plus common annotation issues."""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

import yaml

IMAGE_SUFFIXES = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}


def parse_args():
    parser = argparse.ArgumentParser(description='Check YOLO detection dataset completeness and label quality.')
    parser.add_argument('--data', type=Path, required=True, help='Path to detection data.yaml')
    return parser.parse_args()


def resolve_dataset_root(data_yaml: Path, data: dict) -> Path:
    raw_path = str(data.get('path', '.'))
    root = Path(raw_path)
    if not root.is_absolute():
        root = (data_yaml.parent / root).resolve()
    return root


def collect_images(folder: Path):
    if not folder.exists():
        return []
    return sorted(p for p in folder.rglob('*') if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def check_split(root: Path, split_name: str, split_rel: str, class_names: list[str]):
    image_dir = root / split_rel
    label_dir = root / 'labels' / split_name
    images = collect_images(image_dir)
    labels = sorted(label_dir.glob('*.txt')) if label_dir.exists() else []

    image_stems = {p.stem for p in images}
    label_stems = {p.stem for p in labels}
    missing_labels = sorted(image_stems - label_stems)
    missing_images = sorted(label_stems - image_stems)
    class_counter = Counter()
    invalid_lines = []

    for label_file in labels:
        for line_no, line in enumerate(label_file.read_text(encoding='utf-8').splitlines(), start=1):
            stripped = line.strip()
            if not stripped:
                continue
            parts = stripped.split()
            if len(parts) != 5:
                invalid_lines.append(f'{label_file.name}:{line_no}: expected 5 values, got {len(parts)}')
                continue
            try:
                class_id = int(parts[0])
                coords = [float(v) for v in parts[1:]]
            except ValueError:
                invalid_lines.append(f'{label_file.name}:{line_no}: non-numeric value found')
                continue
            if class_id < 0 or class_id >= len(class_names):
                invalid_lines.append(f'{label_file.name}:{line_no}: class id {class_id} out of range')
                continue
            if any(v < 0 or v > 1 for v in coords):
                invalid_lines.append(f'{label_file.name}:{line_no}: bbox value outside [0,1]')
                continue
            class_counter[class_names[class_id]] += 1

    return {
        'image_count': len(images),
        'label_count': len(labels),
        'class_counts': dict(class_counter),
        'missing_labels': missing_labels[:50],
        'missing_images': missing_images[:50],
        'invalid_lines': invalid_lines[:50],
    }


def main():
    args = parse_args()
    data = yaml.safe_load(args.data.read_text(encoding='utf-8')) or {}
    class_names = data.get('names', {})
    if isinstance(class_names, dict):
        class_names = [class_names[k] for k in sorted(class_names)]
    root = resolve_dataset_root(args.data, data)

    report = {
        'data_yaml': str(args.data),
        'dataset_root': str(root),
        'class_names': class_names,
        'splits': {},
    }

    for split_name in ('train', 'val', 'test'):
        split_rel = data.get(split_name)
        if split_rel:
            report['splits'][split_name] = check_split(root, split_name, split_rel, class_names)

    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
