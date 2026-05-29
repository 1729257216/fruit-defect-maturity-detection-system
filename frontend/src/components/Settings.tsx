import { Settings as SettingsIcon } from 'lucide-react';

interface SettingsProps {
  conf: number;
  setConf: (value: number) => void;
  imgsz: number;
  setImgsz: (value: number) => void;
}

export function Settings({ conf, setConf, imgsz, setImgsz }: SettingsProps) {
  return (
    <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <SettingsIcon className="w-4 h-4 text-gray-600" />
        <h3 className="font-medium text-gray-800 text-sm">检测参数</h3>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">
              置信度阈值
            </label>
            <span className="text-xs font-mono text-primary-600">{conf.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="0.9"
            step="0.05"
            value={conf}
            onChange={(e) => setConf(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-gray-700">
              图像尺寸
            </label>
            <span className="text-xs font-mono text-primary-600">{imgsz}</span>
          </div>
          <select
            value={imgsz}
            onChange={(e) => setImgsz(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value={320}>320px</option>
            <option value={480}>480px</option>
            <option value={640}>640px</option>
            <option value={800}>800px</option>
          </select>
        </div>
      </div>
    </div>
  );
}
