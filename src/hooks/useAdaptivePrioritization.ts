import { useState, useEffect, useCallback } from "react";
import { useUserRole } from "./useUserRole";

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
  const { role, isOwner, isAdmin, isEmployee } = useUserRole();
  const [history, setHistory] = useState<Record<string, ActionHistory>>({});

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("dashboard_action_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse action history", e);
      }
    }
  }, []);

  // Save history to localStorage
  const saveHistory = useCallback((newHistory: Record<string, ActionHistory>) => {
    setHistory(newHistory);
    localStorage.setItem("dashboard_action_history", JSON.stringify(newHistory));
  }, []);

  const recordInteraction = useCallback((actionId: string, type: 'impression' | 'click' | 'resolution' | 'ignore') => {
    const now = new Date().toISOString();
    const current = history[actionId] || {
      id: actionId,
      impressions: 0,
      clicks: 0,
      resolutions: 0,
      ignores: 0,
      lastInteraction: now,
      firstSeen: now,
      consecutiveIgnores: 0
    };

    const updated = { ...current, lastInteraction: now };

    if (type === 'impression') updated.impressions += 1;
    if (type === 'click') {
      updated.clicks += 1;
      updated.consecutiveIgnores = 0; // Reset ignore count on click
    }
    if (type === 'resolution') updated.resolutions += 1;
    if (type === 'ignore') {
      updated.ignores += 1;
      updated.consecutiveIgnores += 1;
    }

    const newHistory = { ...history, [actionId]: updated };
    saveHistory(newHistory);
  }, [history, saveHistory]);

  const getScoreAdjustment = useCallback((actionId: string, baseScore: number) => {
    const data = history[actionId];
    if (!data) return 0;

    let adjustment = 0;

    // 1. Learning from clicks/resolutions
    // If frequently clicked or resolved, increase priority
    const clickRate = data.impressions > 0 ? data.clicks / data.impressions : 0;
    adjustment += clickRate * 100;

    // 2. Learning from ignores
    // If ignored many times consecutively, we might want to:
    // a) Reduce priority to stop annoying the user
    // b) Increase priority (escalation) if it's critical
    // Let's implement escalation for high priority items and reduction for others
    if (data.consecutiveIgnores > 3) {
      // Escalation logic for what would normally be high priority
      if (baseScore > 800) {
        adjustment += data.consecutiveIgnores * 50; // Force it up
      } else {
        adjustment -= data.consecutiveIgnores * 30; // Push it down
      }
    }

    // 3. Profile based weighting
    if (isOwner || isAdmin) {
      // Focus on financial and strategic
      if (actionId.includes('payment') || actionId.includes('quote') || actionId.includes('inactive')) {
        adjustment += 150;
      }
    } else if (isEmployee) {
      // Focus on operational/execution
      if (actionId.includes('today_services') || actionId.includes('overdue_services')) {
        adjustment += 150;
      }
    }

    return adjustment;
  }, [history, isOwner, isAdmin, isEmployee]);

  const getAdaptiveInsight = useCallback((actionId: string, defaultInsight: string) => {
    const data = history[actionId];
    if (!data) return defaultInsight;

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
    getScoreAdjustment,
    getAdaptiveInsight,
    history
  };
}
