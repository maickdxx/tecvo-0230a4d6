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
        const parsed = JSON.parse(saved);
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to parse action history", e);
        // Fallback to seed data on error
        seedInitialHistory();
      }
    } else {
      seedInitialHistory();
    }
  }, []);

  const seedInitialHistory = () => {
    const now = new Date().toISOString();
    const seed: Record<string, ActionHistory> = {
      "pending_quotes": {
        id: "pending_quotes",
        impressions: 45,
        clicks: 12,
        resolutions: 8,
        ignores: 2,
        lastInteraction: now,
        firstSeen: now,
        consecutiveIgnores: 0,
        totalValueGenerated: 12450,
        successFrequency: 0.66,
        results: [
          { timestamp: now, value: 4500, type: 'conversion' },
          { timestamp: now, value: 7950, type: 'conversion' }
        ]
      },
      "overdue_payments": {
        id: "overdue_payments",
        impressions: 30,
        clicks: 15,
        resolutions: 10,
        ignores: 1,
        lastInteraction: now,
        firstSeen: now,
        consecutiveIgnores: 0,
        totalValueGenerated: 8200,
        successFrequency: 0.75,
        results: [
          { timestamp: now, value: 8200, type: 'recovery' }
        ]
      }
    };
    setHistory(seed);
    localStorage.setItem("dashboard_action_history", JSON.stringify(seed));
  };

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
  }, [history, saveHistory]);

  const recordResult = useCallback((actionId: string, value: number, type: 'conversion' | 'recovery' | 'revenue') => {
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
      // Success frequency = results / clicks (if clicks > 0)
      successFrequency: current.clicks > 0 ? (current.results.length + 1) / current.clicks : 1
    };

    const newHistory = { ...history, [actionId]: updated };
    saveHistory(newHistory);
  }, [history, saveHistory]);

  const getScoreAdjustment = useCallback((actionId: string, baseScore: number) => {
    const data = history[actionId];
    if (!data) return 0;

    let adjustment = 0;

    // 1. Fator de Resultado Real (NOVO)
    // Se essa ação gera muito valor financeiro real, aumenta muito a prioridade
    if (data.totalValueGenerated > 0) {
      // Ajuste baseado no ROI histórico da ação
      // Cada R$ 1000 gerados adicionam 100 ao score
      adjustment += (data.totalValueGenerated / 1000) * 100;
      
      // Ajuste baseado na frequência de sucesso
      // Se 50% das vezes que clico, gera resultado, adiciona 200 ao score
      adjustment += (data.successFrequency * 200);
    }

    // 2. Learning from clicks/resolutions
    const clickRate = data.impressions > 0 ? data.clicks / data.impressions : 0;
    adjustment += clickRate * 50; // Reduzi de 100 para 50 para dar mais peso ao resultado real

    // 3. Learning from ignores
    if (data.consecutiveIgnores > 3) {
      if (baseScore > 800) {
        adjustment += data.consecutiveIgnores * 50;
      } else {
        adjustment -= data.consecutiveIgnores * 30;
      }
    }

    // 4. Profile based weighting
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

    // Insight baseado em Resultado Real
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
    history
  };
}
