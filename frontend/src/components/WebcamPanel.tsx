import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, CameraOff, Circle } from 'lucide-react';

interface WebcamPanelProps {
  onFrameCapture: (dataUrl: string) => void;
  isActive: boolean;
  onToggle: () => void;
}

export function WebcamPanel({ onFrameCapture, isActive, onToggle }: WebcamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);

  const [error, setError] = useState<string | null>(null);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setError(null);
    } catch (err) {
      setError('无法访问摄像头，请检查权限设置');
    }
  }, []);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isActive) {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => {
      stopWebcam();
    };
  }, [isActive, startWebcam, stopWebcam]);

  useEffect(() => {
    if (!isActive || !videoRef.current || !canvasRef.current) return;

    intervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          onFrameCapture(dataUrl);
        }
      }
    }, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, onFrameCapture]);

  return (
    <div className="glass-card rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          {isActive ? (
            <Camera className="w-4 h-4 text-mango-500" />
          ) : (
            <CameraOff className="w-4 h-4 text-gray-400" />
          )}
          <span className="text-xs font-medium text-gray-700">摄像头模式</span>
          {isActive && (
            <span className="flex items-center gap-0.5 text-xs text-leaf-600">
              <Circle className="w-1.5 h-1.5 fill-leaf-500" />
              实时检测中
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            isActive
              ? 'bg-rotten-100 text-rotten-700 hover:bg-rotten-200'
              : 'bg-mango-100 text-mango-700 hover:bg-mango-200'
          }`}
        >
          {isActive ? '关闭' : '开启'}
        </button>
      </div>

      {isActive && (
        <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-0 pointer-events-none border-2 border-mango-400/30" />
        </div>
      )}

      {error && (
        <p className="text-xs text-rotten-600 mt-1">{error}</p>
      )}
    </div>
  );
}
