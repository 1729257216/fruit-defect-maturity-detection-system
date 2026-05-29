import { useState, useCallback, useEffect } from 'react';
import type { HistoryItem, DetectionSummary, DetectionItem } from '../types';

const HISTORY_KEY = 'mango_detection_history_v1';
const HISTORY_LIMIT = 10;

export function useHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const saveHistory = useCallback((items: HistoryItem[]) => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  }, []);

  const addToHistory = useCallback((
    filename: string,
    summary: DetectionSummary,
    detections: DetectionItem[],
    originalPreview: string,
    annotatedPreview: string,
    elapsedMs: number,
    confidenceThreshold: number,
    imageSize: number
  ) => {
    const entry: HistoryItem = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: Date.now(),
      filename,
      primaryClass: summary.primary_class || 'unknown',
      highestSeverityClass: summary.highest_severity_class || 'unknown',
      containsRotten: summary.contains_rotten,
      detectionCount: summary.detection_count,
      elapsedMs,
      confidenceThreshold,
      imageSize,
      summary,
      detections,
      originalPreview,
      annotatedPreview,
      starred: false,
    };

    setHistory(prev => {
      const updated = [entry, ...prev].slice(0, HISTORY_LIMIT);
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id);
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  const toggleStar = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.map(item =>
        item.id === id ? { ...item, starred: !item.starred } : item
      );
      saveHistory(updated);
      return updated;
    });
  }, [saveHistory]);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  return {
    history,
    addToHistory,
    removeFromHistory,
    toggleStar,
    clearHistory,
  };
}