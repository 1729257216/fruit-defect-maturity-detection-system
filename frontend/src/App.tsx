import { useState, useCallback } from 'react';
import { Play, Download, FileJson, Loader2 } from 'lucide-react';
import { Header } from './components/Header';
import { ImageUpload } from './components/ImageUpload';
import { ImageEnhancementPanel } from './components/ImageEnhancementPanel';
import { DetectionResults } from './components/DetectionResults';
import { HistoryPanel } from './components/HistoryPanel';
import { Settings } from './components/Settings';
import { Background } from './components/Background';
import { WebcamPanel } from './components/WebcamPanel';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MethodComparisonDiagram } from './components/MethodComparisonDiagram';
import { CnnStructureDiagram } from './components/CnnStructureDiagram';
import { useHistory } from './hooks/useHistory';
import { predict } from './services/api';
import { dataUrlToBlob } from './utils/image';
import type { DetectionSummary, DetectionItem, ImageEnhancement, HistoryItem } from './types';

const DEFAULT_ENHANCEMENTS: ImageEnhancement = {
  brightness: 100,
  contrast: 100,
  sharpness: 100,
  rotation: 0,
};

function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');

  if (view === 'diagram') {
    return <MethodComparisonDiagram />;
  }

  if (view === 'cnn') {
    return <CnnStructureDiagram />;
  }

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [enhancedImage, setEnhancedImage] = useState<string>('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('等待上传图片');

  const [summary, setSummary] = useState<DetectionSummary | null>(null);
  const [detections, setDetections] = useState<DetectionItem[]>([]);
  const [annotatedImage, setAnnotatedImage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showAnnotated, setShowAnnotated] = useState(true);

  const [conf, setConf] = useState(0.25);
  const [imgsz, setImgsz] = useState(640);
  const [enhancements, setEnhancements] = useState<ImageEnhancement>(DEFAULT_ENHANCEMENTS);

  const [isWebcamActive, setIsWebcamActive] = useState(false);

  const { history, addToHistory, removeFromHistory, toggleStar, clearHistory } = useHistory();

  const handleImageSelect = useCallback((file: File, dataUrl: string) => {
    setOriginalImage(dataUrl);
    setEnhancedImage(dataUrl);
    setCurrentFile(file);
    setSummary(null);
    setDetections([]);
    setAnnotatedImage(null);
    setEnhancements(DEFAULT_ENHANCEMENTS);
    setStatusMessage(`已选择图片: ${file.name}`);
  }, []);

  const handleClear = useCallback(() => {
    setOriginalImage(null);
    setEnhancedImage('');
    setCurrentFile(null);
    setSummary(null);
    setDetections([]);
    setAnnotatedImage(null);
    setEnhancements(DEFAULT_ENHANCEMENTS);
    setStatusMessage('等待上传图片');
  }, []);

  const handleWebcamFrame = useCallback(async (dataUrl: string) => {
    if (isProcessing) return;

    try {
      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], `webcam_${Date.now()}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      const result = await predict(file, conf, imgsz, true);

      setSummary(result.summary);
      setDetections(result.detections);
      setElapsedMs(result.elapsed_ms);

      if (result.annotated_image_base64) {
        setAnnotatedImage(`data:image/jpeg;base64,${result.annotated_image_base64}`);
      }

      setOriginalImage(dataUrl);
      setEnhancedImage(dataUrl);
    } catch (error) {
      console.error('Webcam detection error:', error);
    }
  }, [conf, imgsz, isProcessing]);

  const handleDetect = useCallback(async () => {
    if (!currentFile && !enhancedImage) {
      setStatusMessage('请先上传图片');
      return;
    }

    setIsProcessing(true);
    setStatusMessage('图片处理中...');

    try {
      let fileToSend = currentFile;

      if (enhancedImage && enhancedImage !== originalImage) {
        const blob = dataUrlToBlob(enhancedImage);
        fileToSend = new File([blob], currentFile?.name || 'processed.jpg', {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });
      }

      const result = await predict(fileToSend!, conf, imgsz, true);

      setSummary(result.summary);
      setDetections(result.detections);
      setElapsedMs(result.elapsed_ms);

      if (result.annotated_image_base64) {
        setAnnotatedImage(`data:image/jpeg;base64,${result.annotated_image_base64}`);
      }

      addToHistory(
        result.filename,
        result.summary,
        result.detections,
        enhancedImage || originalImage || '',
        result.annotated_image_base64
          ? `data:image/jpeg;base64,${result.annotated_image_base64}`
          : '',
        result.elapsed_ms,
        conf,
        imgsz
      );

      setStatusMessage(`检测完成: 发现 ${result.summary.detection_count} 个目标，耗时 ${result.elapsed_ms}ms`);
    } catch (error) {
      setStatusMessage(`检测失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [currentFile, enhancedImage, originalImage, conf, imgsz, addToHistory]);

  const handleRestoreHistory = useCallback((item: HistoryItem) => {
    setOriginalImage(item.originalPreview);
    setEnhancedImage(item.originalPreview);
    setAnnotatedImage(item.annotatedPreview || null);
    setSummary(item.summary);
    setDetections(item.detections);
    setElapsedMs(item.elapsedMs);
    setConf(item.confidenceThreshold);
    setImgsz(item.imageSize);
    setCurrentFile(null);
    setStatusMessage(`已恢复: ${item.filename}`);
  }, []);

  const handleExportJSON = useCallback(() => {
    if (!summary) return;

    const data = {
      filename: currentFile?.name || 'unknown',
      timestamp: new Date().toISOString(),
      confidence_threshold: conf,
      image_size: imgsz,
      elapsed_ms: elapsedMs,
      summary,
      detections,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `detection_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('JSON 结果已导出');
  }, [summary, currentFile, conf, imgsz, elapsedMs, detections]);

  const handleDownloadAnnotated = useCallback(() => {
    if (!annotatedImage) return;

    const a = document.createElement('a');
    a.href = annotatedImage;
    a.download = `annotated_${Date.now()}.jpg`;
    a.click();
    setStatusMessage('标注图片已下载');
  }, [annotatedImage]);

  const handleBatchExport = useCallback((items: HistoryItem[]) => {
    if (items.length === 0) return;

    if (items.length === 1) {
      const item = items[0];
      const data = {
        filename: item.filename,
        timestamp: new Date(item.timestamp).toISOString(),
        summary: item.summary,
        detections: item.detections,
        elapsed_ms: item.elapsedMs,
        confidence_threshold: item.confidenceThreshold,
        image_size: item.imageSize,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `detection_${item.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const exportData = items.map(item => ({
        filename: item.filename,
        timestamp: new Date(item.timestamp).toISOString(),
        summary: item.summary,
        detections: item.detections,
        elapsed_ms: item.elapsedMs,
        confidence_threshold: item.confidenceThreshold,
        image_size: item.imageSize,
      }));
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `detections_batch_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setStatusMessage(`已导出 ${items.length} 条记录`);
  }, []);

  return (
    <div className="min-h-screen relative">
      <Background />
      <Header />

      <main className="relative z-10 p-2">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-2 space-y-2">
            <ErrorBoundary>
              <div className="glass-card rounded-lg p-2">
                <ImageUpload
                  onImageSelect={handleImageSelect}
                  currentImage={originalImage}
                  onClear={handleClear}
                />
              </div>

              <div className="glass-card rounded-xl p-2">
                <Settings
                conf={conf}
                setConf={setConf}
                imgsz={imgsz}
                setImgsz={setImgsz}
              />
              </div>

              <button
                onClick={handleDetect}
                disabled={!originalImage || isProcessing}
                className="btn-primary btn-ripple w-full py-2.5 px-4 text-white font-semibold rounded-xl flex items-center justify-center gap-2 text-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    开始检测
                  </>
                )}
              </button>

              <div className="glass-card rounded-lg p-2">
                <p className="text-xs text-gray-600 text-center truncate">{statusMessage}</p>
              </div>
            </ErrorBoundary>
          </div>

          <div className="col-span-5 space-y-2">
            <ErrorBoundary>
              {originalImage && (
                <div className="glass-card rounded-xl p-2">
                  <ImageEnhancementPanel
                    sourceImage={originalImage}
                  enhancedImage={enhancedImage}
                  setEnhancedImage={setEnhancedImage}
                  enhancements={enhancements}
                  setEnhancements={setEnhancements}
                />
              </div>
            )}

            <div className="glass-card rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-800 text-sm">检测结果</h3>
                {annotatedImage && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAnnotated(!showAnnotated)}
                      className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                        showAnnotated
                          ? 'bg-mango-100 text-mango-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {showAnnotated ? '隐藏' : '显示'}标注
                    </button>
                    <button
                      onClick={handleDownloadAnnotated}
                      className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="下载标注图"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleExportJSON}
                      className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="导出JSON"
                    >
                      <FileJson className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <DetectionResults
                  summary={summary}
                  detections={detections}
                  annotatedImage={annotatedImage}
                  elapsedMs={elapsedMs}
                  showAnnotated={showAnnotated}
                  isProcessing={isProcessing}
                />
              </div>
            </ErrorBoundary>
          </div>

          <div className="col-span-5 space-y-2">
            <ErrorBoundary>
              <WebcamPanel
                onFrameCapture={handleWebcamFrame}
                isActive={isWebcamActive}
                onToggle={() => setIsWebcamActive(!isWebcamActive)}
              />

              <div className="glass-card rounded-xl p-2 h-full">
                <HistoryPanel
                  history={history}
                  onRestore={handleRestoreHistory}
                  onRemove={removeFromHistory}
                  onClear={clearHistory}
                  onToggleStar={toggleStar}
                  onBatchExport={handleBatchExport}
                />
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
