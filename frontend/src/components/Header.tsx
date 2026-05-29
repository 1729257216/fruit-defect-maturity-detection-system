import { useState, useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { checkHealth } from '../services/api';

export function Header() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [modelAvailable, setModelAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function healthCheck() {
      try {
        const data = await checkHealth();
        if (!mounted) return;
        setModelAvailable(data.model_available);
        setStatus('ok');
      } catch {
        if (!mounted) return;
        setStatus('error');
      }
    }

    healthCheck();
    const interval = setInterval(healthCheck, 3000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-50">
      <div className="px-4">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-mango-400 to-mango-600 flex items-center justify-center shadow-lg shadow-mango-500/30">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-800 text-base">芒果成熟度与缺陷检测</h1>
              <p className="text-xs text-gray-500">基于深度学习的水果质量分析系统</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {status === 'loading' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-mango-100 rounded-full">
                <div className="w-2 h-2 bg-mango-500 rounded-full animate-pulse" />
                <span className="text-xs text-mango-700 font-medium">检测服务状态...</span>
              </div>
            )}
            {status === 'ok' && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-sm ${
                modelAvailable
                  ? 'bg-leaf-100 text-leaf-700'
                  : 'bg-mango-100 text-mango-700'
              }`}>
                {modelAvailable ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                <span>
                  {modelAvailable ? '服务就绪' : '模型未加载'}
                </span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rotten-100 text-rotten-600 rounded-full text-xs font-medium shadow-sm">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>服务不可用</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
