import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const STORAGE_KEY = "tecvo_daily_routine";

interface DailyRoutineData {
  date: string; // YYYY-MM-DD
  completedAlertIds: string[];
}

export function useDailyRoutine() {
  const { session } = useAuth();
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

  // Load from Supabase on mount
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchRoutine = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("daily_routine")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching daily routine from Supabase:", error);
        return;
      }

      if (profile?.daily_routine) {
        const dbRoutine = profile.daily_routine as unknown as DailyRoutineData;
        if (dbRoutine.date === getTodayStr()) {
          setData(dbRoutine);
        } else {
          // Reset for new day
          const resetData = { date: getTodayStr(), completedAlertIds: [] };
          setData(resetData);
          await supabase
            .from("profiles")
            .update({ daily_routine: resetData as any })
            .eq("user_id", session.user.id);
        }
      }
    };

    fetchRoutine();
  }, [session?.user?.id]);

  // Sync to local and remote
  const markAlertAsCompleted = useCallback(async (alertId: string) => {
    const today = getTodayStr();
    setData(prev => {
      if (prev.completedAlertIds.includes(alertId)) return prev;
      const newData = {
        ...prev,
        date: today,
        completedAlertIds: [...prev.completedAlertIds, alertId]
      };
      
      // Update local
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      
      // Update remote (fire and forget or handle error)
      if (session?.user?.id) {
        supabase
          .from("profiles")
          .update({ daily_routine: newData as any })
          .eq("user_id", session.user.id)
          .then(({ error }) => {
            if (error) console.error("Error syncing daily routine:", error);
          });
      }
      
      return newData;
    });
  }, [session?.user?.id]);

  const resetRoutine = useCallback(async () => {
    const resetData = { date: getTodayStr(), completedAlertIds: [] };
    setData(resetData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));
    
    if (session?.user?.id) {
      await supabase
        .from("profiles")
        .update({ daily_routine: resetData as any })
        .eq("user_id", session.user.id);
    }
  }, [session?.user?.id]);

  return {
    completedAlerts: data.completedAlertIds,
    markAlertAsCompleted,
    resetRoutine,
    isComplete: (totalCount: number) => totalCount > 0 && data.completedAlertIds.length >= totalCount
  };
}
