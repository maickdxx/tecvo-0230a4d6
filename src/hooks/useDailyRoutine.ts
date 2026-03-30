import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "tecvo_daily_routine";

interface DailyRoutineData {
  date: string; // YYYY-MM-DD
  completedAlertIds: string[];
}

export function useDailyRoutine() {
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const [data, setData] = useState<DailyRoutineData>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: DailyRoutineData = JSON.parse(saved);
        if (parsed.date === getTodayStr()) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse daily routine data", e);
      }
    }
    return { date: getTodayStr(), completedAlertIds: [] };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const markAlertAsCompleted = useCallback((alertId: string) => {
    setData(prev => {
      if (prev.completedAlertIds.includes(alertId)) return prev;
      return {
        ...prev,
        completedAlertIds: [...prev.completedAlertIds, alertId]
      };
    });
  }, []);

  const resetRoutine = useCallback(() => {
    setData({ date: getTodayStr(), completedAlertIds: [] });
  }, []);

  return {
    completedAlerts: data.completedAlertIds,
    markAlertAsCompleted,
    resetRoutine,
    isComplete: (totalCount: number) => totalCount > 0 && data.completedAlertIds.length >= totalCount
  };
}
