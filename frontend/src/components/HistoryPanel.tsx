import { useState, useMemo } from 'react';
import { History, Trash2, RotateCcw, Search, X, ChevronDown, ChevronUp, Filter, Star, Download } from 'lucide-react';
import type { HistoryItem } from '../types';
import { CLASS_LABELS, CLASS_COLORS } from '../utils/image';

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onToggleStar: (id: string) => void;
  onBatchExport: (items: HistoryItem[]) => void;
}

const MAX_VISIBLE_ITEMS = 3;

export function HistoryPanel({ history, onRestore, onRemove, onClear, onToggleStar, onBatchExport }: HistoryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRotten, setFilterRotten] = useState(false);
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  const filteredHistory = useMemo(() => {
    let result = history;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => item.filename.toLowerCase().includes(query));
    }

    if (filterRotten) {
      result = result.filter(item => item.containsRotten);
    }

    if (showStarredOnly) {
      result = result.filter(item => item.starred);
    }

    return result;
  }, [history, searchQuery, filterRotten, showStarredOnly]);

  const visibleHistory = useMemo(() => {
    if (isExpanded || filteredHistory.length <= MAX_VISIBLE_ITEMS) {
      return filteredHistory;
    }
    return filteredHistory.slice(0, MAX_VISIBLE_ITEMS);
  }, [filteredHistory, isExpanded]);

  const hasMore = filteredHistory.length > MAX_VISIBLE_ITEMS;
  const starredCount = history.filter(item => item.starred).length;

  return (
    <div className="h-full flex flex-col text-xs">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <History className="w-4 h-4 text-gray-600" />
          <h3 className="font-medium text-gray-800">历史记录</h3>
          {filteredHistory.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-mango-100 text-mango-700 rounded-full">
              {filteredHistory.length}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <div className="flex items-center gap-1">
            {starredCount > 0 && (
              <button
                onClick={() => onBatchExport(history.filter(item => item.starred))}
                className="p-1 text-mango-500 hover:text-mango-700 hover:bg-mango-50 rounded transition-colors"
                title={`导出收藏 (${starredCount})`}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClear}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="清空历史"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mb-2 space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件名..."
              className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-mango-300"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              >
                <X className="w-3 h-3 text-gray-400" />
              </button>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setFilterRotten(!filterRotten)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterRotten
                  ? 'bg-rotten-100 text-rotten-700'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-3 h-3" />
              含腐烂
            </button>
            <button
              onClick={() => setShowStarredOnly(!showStarredOnly)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                showStarredOnly
                  ? 'bg-mango-100 text-mango-700'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Star className="w-3 h-3" />
              {showStarredOnly ? '已收藏' : '收藏'}
              {starredCount > 0 && <span>({starredCount})</span>}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto scrollbar-thin">
        {filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <History className="w-8 h-8 mb-1 opacity-50" />
            <p className="text-xs">
              {searchQuery || filterRotten || showStarredOnly ? '无匹配结果' : '暂无历史记录'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleHistory.map((item) => (
                <div
                  key={item.id}
                  className={`group relative bg-gray-50 rounded-lg p-2 hover:bg-gray-100 transition-colors cursor-pointer ${item.starred ? 'ring-1 ring-mango-300' : ''}`}
                  onClick={() => onRestore(item)}
                >
                  <div className="flex gap-2">
                    <div className="w-12 h-12 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                      {item.originalPreview && (
                        <img
                          src={item.originalPreview}
                          alt={item.filename}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-medium text-gray-800 truncate flex-1">
                          {item.filename}
                        </p>
                        {item.starred && (
                          <Star className="w-3 h-3 text-mango-500 fill-mango-500 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className="text-xs px-1 py-0.5 rounded"
                          style={{
                            backgroundColor: `${CLASS_COLORS[item.primaryClass]}20`,
                            color: CLASS_COLORS[item.primaryClass],
                          }}
                        >
                          {CLASS_LABELS[item.primaryClass] || item.primaryClass}
                        </span>
                        {item.containsRotten && (
                          <span className="text-xs px-1 py-0.5 rounded bg-rotten-100 text-rotten-600">
                            含腐烂
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(item.timestamp).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {' · '}{item.detectionCount}个目标
                      </p>
                    </div>
                  </div>

                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(item.id);
                      }}
                      className={`p-1 bg-white shadow rounded transition-colors ${
                        item.starred
                          ? 'text-mango-500 hover:text-mango-700'
                          : 'text-gray-600 hover:text-mango-600 hover:bg-mango-50'
                      }`}
                      title={item.starred ? '取消收藏' : '收藏'}
                    >
                      <Star className={`w-3 h-3 ${item.starred ? 'fill-mango-500' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(item);
                      }}
                      className="p-1 bg-white shadow rounded hover:bg-mango-50 text-gray-600 hover:text-mango-600 transition-colors"
                      title="恢复"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(item.id);
                      }}
                      className="p-1 bg-white shadow rounded hover:bg-red-50 text-gray-600 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full mt-2 flex items-center justify-center gap-1 py-1.5 bg-mango-50 hover:bg-mango-100 text-mango-700 rounded-lg text-xs font-medium transition-colors"
              >
                {isExpanded ? (
                  <>
                    <span>收起</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>展开剩余 {filteredHistory.length - MAX_VISIBLE_ITEMS} 条</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}