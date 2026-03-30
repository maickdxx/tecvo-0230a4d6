import { useState, useEffect, useCallback } from "react";
import { useUserRole } from "./useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ActionResult {
  timestamp: string;
  value: number;
  type: 'conversion' | 'recovery' | 'revenue';
}

export interface ActionHistory {
  id: string;
  impressions: number;
  clicks: number;
  resolutions: number;
  ignores: number;
  lastInteraction: string;
  firstSeen: string;
  consecutiveIgnores: number;
  results: ActionResult[];
  totalValueGenerated: number;
  successFrequency: number; // 0 to 1
}

export function useAdaptivePrioritization() {
  const { session } = useAuth();
  const { role, isOwner, isAdmin, isEmployee } = useUserRole();
  const [history, setHistory] = useState<Record<string, ActionHistory>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load history from Supabase or localStorage
  useEffect(() => {
    const loadHistory = async () => {
      // 1. Check local storage
      const saved = localStorage.getItem("dashboard_action_history");
      let localData = null;
      if (saved) {
        try {
          localData = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to parse action history", e);
        }
      }

      // 2. Fetch from Supabase if session exists
      if (session?.user?.id) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("dashboard_action_history")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!error && profile?.dashboard_action_history) {
          const dbData = profile.dashboard_action_history as unknown as Record<string, ActionHistory>;
          // Merge if necessary, prioritizing database
          setHistory(dbData);
          setIsLoaded(true);
          return;
        }
      }

      // 3. Fallback to local data or seed initial history
      if (localData) {
        setHistory(localData);
      } else {
        seedInitialHistory();
      }
      setIsLoaded(true);
    };

    loadHistory();
  }, [session?.user?.id]);

  const seedInitialHistory = () => {
    setHistory({});
  };

  // Save history to both localStorage and Supabase
  const saveHistory = useCallback(async (newHistory: Record<string, ActionHistory>) => {
    setHistory(newHistory);
    localStorage.setItem("dashboard_action_history", JSON.stringify(newHistory));
    
    if (session?.user?.id) {
      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_action_history: newHistory as any })
        .eq("user_id", session.user.id);
      
      if (error) console.error("Error saving action history to Supabase:", error);
    }
  }, [session?.user?.id]);

  const recordInteraction = useCallback((actionId: string, type: 'impression' | 'click' | 'resolution' | 'ignore') => {
    if (!isLoaded) return;
    
    const now = new Date().toISOString();
    const current = history[actionId] || {
      id: actionId,
      impressions: 0,
      clicks: 0,
      resolutions: 0,
      ignores: 0,
      lastInteraction: now,
      firstSeen: now,
      consecutiveIgnores: 0,
      results: [],
      totalValueGenerated: 0,
      successFrequency: 0
    };

    const updated = { ...current, lastInteraction: now };

    if (type === 'impression') updated.impressions += 1;
    if (type === 'click') {
      updated.clicks += 1;
      updated.consecutiveIgnores = 0;
    }
    if (type === 'resolution') {
      updated.resolutions += 1;
      updated.consecutiveIgnores = 0;
    }
    if (type === 'ignore') {
      updated.ignores += 1;
      updated.consecutiveIgnores += 1;
    }

    const newHistory = { ...history, [actionId]: updated };
    saveHistory(newHistory);
  }, [history, isLoaded, saveHistory]);

  const recordResult = useCallback((actionId: string, value: number, type: 'conversion' | 'recovery' | 'revenue') => {
    if (!isLoaded) return;

    const now = new Date().toISOString();
    const current = history[actionId] || {
      id: actionId,
      impressions: 0,
      clicks: 0,
      resolutions: 0,
      ignores: 0,
      lastInteraction: now,
      firstSeen: now,
      consecutiveIgnores: 0,
      results: [],
      totalValueGenerated: 0,
      successFrequency: 0
    };

    const newResult: ActionResult = { timestamp: now, value, type };
    const updated = { 
      ...current, 
      lastInteraction: now,
      results: [...current.results, newResult],
      totalValueGenerated: current.totalValueGenerated + value,
      successFrequency: current.clicks > 0 ? (current.results.length + 1) / current.clicks : 1
    };

    const newHistory = { ...history, [actionId]: updated };
    saveHistory(newHistory);
  }, [history, isLoaded, saveHistory]);

  const getScoreAdjustment = useCallback((actionId: string, baseScore: number) => {
    const data = history[actionId];
    if (!data) return 0;

    let adjustment = 0;

    if (data.totalValueGenerated > 0) {
      adjustment += (data.totalValueGenerated / 1000) * 100;
      adjustment += (data.successFrequency * 200);
    }

    const clickRate = data.impressions > 0 ? data.clicks / data.impressions : 0;
    adjustment += clickRate * 50; 

    if (data.consecutiveIgnores > 3) {
      if (baseScore > 800) {
        adjustment += data.consecutiveIgnores * 50;
      } else {
        adjustment -= data.consecutiveIgnores * 30;
      }
    }

    if (isOwner || isAdmin) {
      if (actionId.includes('payment') || actionId.includes('quote') || actionId.includes('inactive')) {
        adjustment += 150;
      }
    } else if (isEmployee) {
      if (actionId.includes('today_services') || actionId.includes('overdue_services')) {
        adjustment += 150;
      }
    }

    return adjustment;
  }, [history, isOwner, isAdmin, isEmployee]);

  const getAdaptiveInsight = useCallback((actionId: string, defaultInsight: string) => {
    const data = history[actionId];
    if (!data) return defaultInsight;

    if (data.totalValueGenerated > 0) {
      const formattedValue = new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(data.totalValueGenerated);

      return `Ações como essa já geraram ${formattedValue} para você em resultados reais.`;
    }

    if (data.consecutiveIgnores >= 3) {
      if (actionId === 'overdue_payments') return "Atenção: esse valor continua parado e impactando seu caixa.";
      if (actionId === 'pending_quotes') return "Você ignorou esses orçamentos, mas eles são oportunidades reais de venda.";
      return `Você ignorou isso por ${data.consecutiveIgnores} dias. Resolver agora evita acúmulo.`;
    }

    if (data.resolutions > 5) {
      return "Você costuma resolver isso rápido. Mantenha o ritmo!";
    }

    return defaultInsight;
  }, [history]);

  return {
    recordInteraction,
    recordResult,
    getScoreAdjustment,
    getAdaptiveInsight,
    history,
    isLoaded
  };
}
