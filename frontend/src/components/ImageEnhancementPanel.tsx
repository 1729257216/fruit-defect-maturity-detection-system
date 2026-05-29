import { useCallback, useEffect, useRef } from 'react';
import { RotateCcw, Sun, Contrast, Sparkles } from 'lucide-react';
import type { ImageEnhancement } from '../types';

interface ImageEnhancementPanelProps {
  sourceImage: string | null;
  enhancedImage: string;
  setEnhancedImage: (dataUrl: string) => void;
  enhancements: ImageEnhancement;
  setEnhancements: (enhancements: ImageEnhancement | ((prev: ImageEnhancement) => ImageEnhancement)) => void;
}

export function ImageEnhancementPanel({
  sourceImage,
  setEnhancedImage,
  enhancements,
  setEnhancements,
}: ImageEnhancementPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLImageElement | null>(null);

  const updateCanvas = useCallback(async () => {
    if (!sourceImage || !canvasRef.current) return;

    if (!sourceRef.current || sourceRef.current.src !== sourceImage) {
      const img = new Image();
      img.onload = () => {
        sourceRef.current = img;
        applyFilters(img);
      };
      img.src = sourceImage;
    } else {
      applyFilters(sourceRef.current);
    }
  }, [sourceImage, enhancements]);

  const applyFilters = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxDim = 1280;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;

    ctx.save();

    if (enhancements.rotation !== 0) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((enhancements.rotation * Math.PI) / 180);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
    }

    ctx.filter = `brightness(${enhancements.brightness}%) contrast(${enhancements.contrast}%)`;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (enhancements.sharpness > 100) {
      ctx.filter = 'none';
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.filter = `saturate(${enhancements.sharpness / 100})`;
        tempCtx.drawImage(canvas, 0, 0);
        ctx.drawImage(tempCanvas, 0, 0);
      }
    }

    ctx.restore();
    setEnhancedImage(canvas.toDataURL('image/jpeg', 0.92));
  };

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  const handleReset = () => {
    setEnhancements({
      brightness: 100,
      contrast: 100,
      sharpness: 100,
      rotation: 0,
    });
  };

  const handleRotation = (direction: 'left' | 'right') => {
    setEnhancements(prev => ({
      ...prev,
      rotation: (prev.rotation + (direction === 'left' ? -90 : 90)) % 360,
    }));
  };

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <Sun className="w-3 h-3 text-mango-500" />
          <span className="font-medium text-gray-700">图像增强</span>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          重置
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-2">
        <div className="flex items-center gap-2">
          <Sun className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min="50"
            max="150"
            value={enhancements.brightness}
            onChange={(e) => setEnhancements(prev => ({ ...prev, brightness: Number(e.target.value) }))}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-mango-500"
          />
          <span className="w-8 text-xs text-gray-500 text-right">{enhancements.brightness}%</span>
        </div>

        <div className="flex items-center gap-2">
          <Contrast className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min="50"
            max="150"
            value={enhancements.contrast}
            onChange={(e) => setEnhancements(prev => ({ ...prev, contrast: Number(e.target.value) }))}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-mango-500"
          />
          <span className="w-8 text-xs text-gray-500 text-right">{enhancements.contrast}%</span>
        </div>

        <div className="flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <input
            type="range"
            min="50"
            max="200"
            value={enhancements.sharpness}
            onChange={(e) => setEnhancements(prev => ({ ...prev, sharpness: Number(e.target.value) }))}
            className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-mango-500"
          />
          <span className="w-8 text-xs text-gray-500 text-right">{enhancements.sharpness}%</span>
        </div>

        <div className="flex gap-1.5">
          <button
            onClick={() => handleRotation('left')}
            className="flex-1 py-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            左转
          </button>
          <button
            onClick={() => handleRotation('right')}
            className="flex-1 py-1 px-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            右转
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
