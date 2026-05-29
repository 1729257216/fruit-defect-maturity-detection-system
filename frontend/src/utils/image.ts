import type { ImageEnhancement } from '../types';

export function applyEnhancements(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement | HTMLImageElement,
  enhancements: ImageEnhancement
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { brightness, contrast, sharpness, rotation } = enhancements;
  const width = source instanceof HTMLCanvasElement ? source.width : source.width;
  const height = source instanceof HTMLCanvasElement ? source.height : source.height;

  canvas.width = width;
  canvas.height = height;

  ctx.save();

  if (rotation !== 0) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-canvas.width / 2, -canvas.height / 2);
  }

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  if (sharpness > 1) {
    ctx.filter += ` blur(${Math.max(0, (100 - sharpness) / 50)}px)`;
  }

  ctx.drawImage(source, 0, 0);

  if (sharpness > 100) {
    ctx.filter = 'none';
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.filter = `saturate(${sharpness / 100})`;
      tempCtx.drawImage(canvas, 0, 0);
      ctx.drawImage(tempCanvas, 0, 0);
    }
  }

  ctx.restore();
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function compressImage(
  dataUrl: string,
  maxEdge: number = 1280,
  quality: number = 0.9
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

export const CLASS_LABELS: Record<string, string> = {
  unripe: '未熟',
  ripe: '成熟',
  slight_rotten: '轻度腐烂',
  severe_rotten: '重度腐烂',
};

export const CLASS_COLORS: Record<string, string> = {
  unripe: '#22c55e',
  ripe: '#eab308',
  slight_rotten: '#f97316',
  severe_rotten: '#ef4444',
};

export function getSeverityLabel(rank: number): string {
  if (rank >= 3) return '高风险';
  if (rank >= 2) return '中风险';
  if (rank >= 0) return '低风险';
  return '未定义';
}

export function getRiskLevel(containsRotten: boolean, highestClass: string | null): 'low' | 'medium' | 'high' {
  if (!containsRotten) return 'low';
  if (highestClass === 'slight_rotten') return 'medium';
  return 'high';
}
