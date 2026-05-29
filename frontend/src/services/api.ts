import type { HealthResponse, PredictResponse } from '../types';

const API_BASE = '';

export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchClasses(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/v1/classes`);
  if (!res.ok) throw new Error('Failed to fetch classes');
  const data = await res.json();
  return data.classes;
}

export async function predict(
  imageFile: File,
  conf: number,
  imgsz: number,
  returnAnnotated: boolean = true
): Promise<PredictResponse> {
  const formData = new FormData();
  formData.append('image', imageFile);

  const params = new URLSearchParams({
    conf: String(conf),
    imgsz: String(imgsz),
    return_annotated: String(returnAnnotated),
  });

  const res = await fetch(`${API_BASE}/api/v1/predict?${params}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${res.status}`);
  }

  return res.json();
}
