export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectionItem {
  class_id: number;
  class_name: string;
  confidence: number;
  severity_rank: number;
  box: BoundingBox;
}

export interface DetectionSummary {
  detection_count: number;
  class_counts: Record<string, number>;
  contains_rotten: boolean;
  highest_severity_class: string | null;
  primary_class: string | null;
}

export interface PredictResponse {
  filename: string;
  width: number;
  height: number;
  confidence_threshold: number;
  image_size: number;
  elapsed_ms: number;
  summary: DetectionSummary;
  detections: DetectionItem[];
  annotated_image_base64?: string;
}

export interface HealthResponse {
  status: 'ok';
  model_weights: string;
  model_available: boolean;
  docs_url: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  filename: string;
  primaryClass: string;
  highestSeverityClass: string;
  containsRotten: boolean;
  detectionCount: number;
  elapsedMs: number;
  confidenceThreshold: number;
  imageSize: number;
  summary: DetectionSummary;
  detections: DetectionItem[];
  originalPreview: string;
  annotatedPreview: string;
  starred?: boolean;
}

export interface ImageEnhancement {
  brightness: number;
  contrast: number;
  sharpness: number;
  rotation: number;
}
