import { useState, useRef, useCallback, useEffect } from 'react';

interface ImageZoomProps {
  src: string | null;
  alt: string;
}

export function ImageZoom({ src, alt }: ImageZoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isHovering || scale === 1) {
      return;
    }
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  }, [isHovering, scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - lastPos.x, y: e.clientY - lastPos.y });
    }
  }, [scale, lastPos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setLastPos(position);
    }
    setIsDragging(false);
  }, [isDragging, position]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setLastPos(position);
      }
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, position]);

  const handleReset = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setLastPos({ x: 0, y: 0 });
  }, []);

  if (!src) return null;

  return (
    <div
      ref={containerRef}
      className={`relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200 ${scale > 1 ? 'cursor-grab' : 'cursor-zoom-in'} ${isDragging ? 'cursor-grabbing' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onDoubleClick={handleReset}
    >
      <div
        className="w-full h-full overflow-hidden"
        style={{
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: isDragging ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
      {scale !== 1 && (
        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-xs">
          {Math.round(scale * 100)}% · 滚轮缩放 · 拖拽移动
        </div>
      )}
    </div>
  );
}