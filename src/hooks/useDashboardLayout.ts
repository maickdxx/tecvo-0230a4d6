import { useState, useCallback, useMemo } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface DashboardWidget {
  id: string;
  visible: boolean;
}

export const WIDGET_LABELS: Record<string, string> = {
  bloco_hoje: "Bloco Hoje (Serviços e Faturamento)",
  resultado_periodo: "Resultado do Período (Receita, Gastos, Lucro)",
  agenda_resumida: "Agenda Resumida (Próximos Serviços)",
  alertas_inteligentes: "Alertas Inteligentes",
  eficiencia_operacional: "Eficiência Operacional",
  motor_receita: "Motor de Receita",
  saude_empresa: "Saúde da Empresa",
  graficos_detalhados: "Gráficos Detalhados",
  performance_tempo: "Performance de Tempo (Estimado vs Real)",
};

const DEFAULT_LAYOUT: DashboardWidget[] = Object.keys(WIDGET_LABELS).map((id) => ({
  id,
  visible: true,
}));

export function useDashboardLayout() {
  const { profile, user, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const layout: DashboardWidget[] = useMemo(() => {
    const saved = profile?.dashboard_layout;
    if (!saved || !Array.isArray(saved)) return DEFAULT_LAYOUT;

    // Merge: keep saved order/visibility but ensure new widgets are included
    const savedIds = new Set(saved.map((w: DashboardWidget) => w.id));
    // Remove old widgets that no longer exist
    const validSaved = saved.filter((w: DashboardWidget) => WIDGET_LABELS[w.id]);
    const merged = [
      ...validSaved,
      ...DEFAULT_LAYOUT.filter((w) => !savedIds.has(w.id)),
    ];
    return merged;
  }, [profile?.dashboard_layout]);

  const isVisible = useCallback(
    (widgetId: string) => {
      const widget = layout.find((w) => w.id === widgetId);
      return widget ? widget.visible : true;
    },
    [layout]
  );

  const saveLayout = useCallback(
    async (items: DashboardWidget[]) => {
      if (!user) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ dashboard_layout: items as any })
          .eq("user_id", user.id);
        if (error) throw error;
        await refreshProfile();
        toast.success("Layout salvo com sucesso!");
      } catch {
        toast.error("Erro ao salvar layout");
      } finally {
        setSaving(false);
      }
    },
    [user, refreshProfile]
  );

  const resetLayout = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ dashboard_layout: null })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Layout restaurado ao padrão!");
    } catch {
      toast.error("Erro ao restaurar layout");
    } finally {
      setSaving(false);
    }
  }, [user, refreshProfile]);

  return { layout, isVisible, saveLayout, resetLayout, saving, DEFAULT_LAYOUT };
}
