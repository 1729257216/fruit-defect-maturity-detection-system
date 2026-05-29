import { useRef, useEffect, useMemo, useState } from 'react';
import type { DetectionItem } from '../types';
import { CLASS_COLORS, CLASS_LABELS } from '../utils/image';

interface DetectionBoxCanvasProps {
  detections: DetectionItem[];
  maxDisplay?: number;
}

export function DetectionBoxCanvas({ detections, maxDisplay = 20 }: DetectionBoxCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });

  const displayDetections = useMemo(() => {
    return detections
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxDisplay);
  }, [detections, maxDisplay]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width || 300,
          height: Math.min(rect.height || 200, 150),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    if (displayDetections.length === 0) {
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(
        '暂无检测目标',
        dimensions.width / 2,
        dimensions.height / 2
      );
      return;
    }

    const padding = 8;
    const itemHeight = 28;
    const maxItems = Math.floor((dimensions.height - padding * 2) / itemHeight);

    displayDetections.slice(0, maxItems).forEach((det, index) => {
      const y = padding + index * itemHeight;
      const color = CLASS_COLORS[det.class_name] || '#6b7280';

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(padding + 6, y + 10, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1f2937';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(
        CLASS_LABELS[det.class_name] || det.class_name,
        padding + 18,
        y + 14
      );

      ctx.fillStyle = color;
      ctx.font = '500 11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${(det.confidence * 100).toFixed(1)}%`,
        dimensions.width - padding,
        y + 14
      );
    });

    const omitted = displayDetections.length - maxItems;
    if (omitted > 0) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `... 还有 ${omitted} 个目标`,
        dimensions.width / 2,
        dimensions.height - 8
      );
    }
  }, [displayDetections, dimensions]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[100px] bg-white rounded-lg border border-gray-200"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
        className="block"
      />
    </div>
  );
}