import { useMemo, useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Clock, Target, Loader2 } from 'lucide-react';
import type { DetectionSummary, DetectionItem } from '../types';
import { CLASS_LABELS, CLASS_COLORS, getRiskLevel } from '../utils/image';
import { ImageZoom } from './ImageZoom';
import { DetectionBoxCanvas } from './DetectionBoxCanvas';

interface DetectionResultsProps {
  summary: DetectionSummary | null;
  detections: DetectionItem[];
  annotatedImage: string | null;
  elapsedMs: number;
  showAnnotated: boolean;
  isProcessing?: boolean;
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [displayValue, setDisplayValue] = useState(0);
  const prevValue = useRef(value);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    const duration = 400;
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(end);
        prevValue.current = end;
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span className={className}>{displayValue}</span>;
}

export function DetectionResults({
  summary,
  detections,
  annotatedImage,
  elapsedMs,
  showAnnotated,
  isProcessing,
}: DetectionResultsProps) {
  const riskLevel = useMemo(() => {
    if (!summary) return null;
    return getRiskLevel(summary.contains_rotten, summary.highest_severity_class);
  }, [summary]);

  const riskConfig = useMemo(() => {
    switch (riskLevel) {
      case 'low':
        return {
          bg: 'bg-leaf-50',
          border: 'border-leaf-200',
          text: 'text-leaf-700',
          icon: CheckCircle,
          label: '低风险',
          message: '未检测到腐烂目标，样本整体质量良好',
          flashClass: '',
        };
      case 'medium':
        return {
          bg: 'bg-mango-100',
          border: 'border-mango-300',
          text: 'text-mango-700',
          icon: AlertTriangle,
          label: '中风险',
          message: '检测到轻度腐烂，建议人工复查',
          flashClass: 'animate-flash-warning',
        };
      case 'high':
        return {
          bg: 'bg-rotten-50',
          border: 'border-rotten-200',
          text: 'text-rotten-600',
          icon: AlertTriangle,
          label: '高风险',
          message: '检测到重度腐烂，建议优先剔除',
          flashClass: 'animate-flash-danger',
        };
      default:
        return {
          bg: 'bg-mango-50',
          border: 'border-mango-200',
          text: 'text-mango-700',
          icon: Target,
          label: '等待检测',
          message: '上传图片后显示检测结果',
          flashClass: '',
        };
    }
  }, [riskLevel]);

  if (isProcessing) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-mango-500 py-12 relative overflow-hidden rounded-lg">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-mango-50/50 to-transparent animate-pulse" />
        <div className="relative z-10">
          <div className="w-16 h-16 rounded-full bg-mango-100 flex items-center justify-center mb-4 animate-breathe">
            <Loader2 className="w-8 h-8 text-mango-500 animate-spin" />
          </div>
          <p className="text-sm font-medium text-mango-700">正在分析图片...</p>
          <p className="text-xs text-mango-500 mt-1">请稍候</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 py-8">
        <Target className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm font-medium">暂无检测结果</p>
        <p className="text-xs mt-0.5">上传图片后开始检测</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden text-xs">
      {annotatedImage && showAnnotated && (
        <div className="h-auto max-h-[50vh] mb-2 overflow-hidden">
          <ImageZoom src={annotatedImage} alt="检测结果" />
        </div>
      )}

      <div className={`p-3 rounded-lg border ${riskConfig.bg} ${riskConfig.border} ${riskConfig.flashClass} risk-transition`}>
        <div className="flex items-start gap-2">
          <riskConfig.icon className={`w-4 h-4 mt-0.5 ${riskConfig.text}`} />
          <div>
            <p className={`font-semibold ${riskConfig.text}`}>{riskConfig.label}</p>
            <p className={`text-xs mt-0.5 ${riskConfig.text.replace('700', '600').replace('600', '500')}`}>
              {riskConfig.message}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="bg-gradient-to-br from-mango-50 to-mango-100 rounded-lg p-2 border border-mango-200">
          <p className="text-xs text-mango-600">检测数量</p>
          <p className="text-lg font-bold text-mango-700">
            <AnimatedNumber value={summary.detection_count} />
          </p>
        </div>
        <div className="bg-gradient-to-br from-leaf-50 to-leaf-100 rounded-lg p-2 border border-leaf-200">
          <p className="text-xs text-leaf-600">处理耗时</p>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-leaf-500" />
            <p className="text-lg font-bold text-leaf-700 animate-count-up">{elapsedMs}ms</p>
          </div>
        </div>
      </div>

      {summary.primary_class && (
        <div className="mt-2 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-2 border border-gray-200">
          <p className="text-xs text-gray-500">主要类别</p>
          <p
            className="text-sm font-bold animate-count-up"
            style={{ color: CLASS_COLORS[summary.primary_class] || '#666' }}
          >
            {CLASS_LABELS[summary.primary_class] || summary.primary_class}
          </p>
        </div>
      )}

      {detections.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <h4 className="text-xs font-semibold text-gray-700">检测详情 ({detections.length})</h4>
          </div>
          <DetectionBoxCanvas detections={detections} maxDisplay={20} />
        </div>
      )}
    </div>
  );
}