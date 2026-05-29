import type { DetectionItem, BoundingBox } from '../types';

export function calculateIoU(box1: BoundingBox, box2: BoundingBox): number {
  const x1 = Math.max(box1.x1, box2.x1);
  const y1 = Math.max(box1.y1, box2.y1);
  const x2 = Math.min(box1.x2, box2.x2);
  const y2 = Math.min(box1.y2, box2.y2);

  if (x2 < x1 || y2 < y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = (box1.x2 - box1.x1) * (box1.y2 - box1.y1);
  const area2 = (box2.x2 - box2.x1) * (box2.y2 - box2.y1);
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

export function nms(
  detections: DetectionItem[],
  iouThreshold: number = 0.5,
  minConfidence: number = 0.1
): DetectionItem[] {
  if (detections.length === 0) return [];

  const filtered = detections
    .filter(d => d.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence);

  const keep: DetectionItem[] = [];

  while (filtered.length > 0) {
    const best = filtered[0];
    keep.push(best);

    filtered.splice(0, 1);

    for (let i = filtered.length - 1; i >= 0; i--) {
      if (best.class_name === filtered[i].class_name) {
        const iou = calculateIoU(best.box, filtered[i].box);
        if (iou > iouThreshold) {
          filtered.splice(i, 1);
        }
      }
    }
  }

  return keep;
}

export function mergeOverlappingBoxes(
  detections: DetectionItem[],
  mergeThreshold: number = 0.7,
  minConfidence: number = 0.1
): DetectionItem[] {
  const byClass = new Map<string, DetectionItem[]>();

  for (const det of detections) {
    if (det.confidence < minConfidence) continue;
    
    if (!byClass.has(det.class_name)) {
      byClass.set(det.class_name, []);
    }
    byClass.get(det.class_name)!.push(det);
  }

  const merged: DetectionItem[] = [];

  for (const [, boxes] of byClass) {
    const sorted = boxes.sort((a, b) => b.confidence - a.confidence);

    while (sorted.length > 0) {
      const current = sorted[0];
      sorted.splice(0, 1);

      let mergedBox = { ...current };
      let count = 1;

      for (let i = sorted.length - 1; i >= 0; i--) {
        const iou = calculateIoU(mergedBox.box, sorted[i].box);
        if (iou > mergeThreshold) {
          mergedBox.box.x1 = (mergedBox.box.x1 * count + sorted[i].box.x1) / (count + 1);
          mergedBox.box.y1 = (mergedBox.box.y1 * count + sorted[i].box.y1) / (count + 1);
          mergedBox.box.x2 = (mergedBox.box.x2 * count + sorted[i].box.x2) / (count + 1);
          mergedBox.box.y2 = (mergedBox.box.y2 * count + sorted[i].box.y2) / (count + 1);
          mergedBox.confidence = (mergedBox.confidence * count + sorted[i].confidence) / (count + 1);

          count++;
          sorted.splice(i, 1);
        }
      }

      merged.push(mergedBox);
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence);
}
