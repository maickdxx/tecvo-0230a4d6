import { useMemo } from "react";
import { Sun, Sunrise, Moon, Flame } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/hooks/useDemoMode";
import { getTodayInTz } from "@/lib/timezone";

function getGreeting(): { text: string; Icon: typeof Sun } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: "Bom dia", Icon: Sunrise };
  if (hour < 18) return { text: "Boa tarde", Icon: Sun };
  return { text: "Boa noite", Icon: Moon };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function DashboardGreeting() {
  const { profile, organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const { text: greeting, Icon } = useMemo(getGreeting, []);

  const firstName = profile?.full_name?.split(" ")[0] || "";

  const { data: todaySummary } = useQuery({
    queryKey: ["greeting-today-summary", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return null;
      const today = getTodayInTz();
      const dayStart = `${today}T00:00:00`;
      const dayEnd = `${today}T23:59:59`;

      let q = supabase
        .from("services")
        .select("id, value, status")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .neq("status", "cancelled")
        .gte("scheduled_date", dayStart)
        .lte("scheduled_date", dayEnd);

      if (!isDemoMode) q = q.eq("is_demo_data", false);

      const { data } = await q;
      const services = data || [];
      const count = services.length;
      const totalValue = services.reduce((s, sv) => s + (Number(sv.value) || 0), 0);
      const completed = services.filter((s) => s.status === "completed").length;

      return { count, totalValue, completed };
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  // Streak — count consecutive days with at least 1 session
  const { data: streak } = useQuery({
    queryKey: ["login-streak", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return 0;
      // Get last 30 days of sessions, grouped by day
      const { data } = await supabase
        .from("user_sessions")
        .select("started_at")
        .eq("user_id", profile.id)
        .gte("started_at", new Date(Date.now() - 30 * 86400_000).toISOString())
        .order("started_at", { ascending: false })
        .limit(200);

      if (!data || data.length === 0) return 1;

      const uniqueDays = new Set(
        data.map((s) => s.started_at?.substring(0, 10))
      );

      let count = 0;
      const d = new Date();
      for (let i = 0; i < 30; i++) {
        const dateStr = d.toISOString().substring(0, 10);
        if (uniqueDays.has(dateStr)) {
          count++;
        } else if (i > 0) {
          break; // streak broken
        }
        d.setDate(d.getDate() - 1);
      }
      return count;
    },
    enabled: !!profile?.id,
    staleTime: 300_000,
  });

  return (
    <div className="mb-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              {greeting}{firstName ? `, ${firstName}` : ""}! 👋
            </h1>
            {todaySummary && todaySummary.count > 0 ? (
              <p className="text-sm text-muted-foreground mt-0.5">
                Você tem <span className="font-semibold text-foreground">{todaySummary.count} serviço{todaySummary.count !== 1 ? "s" : ""}</span> hoje
                {todaySummary.totalValue > 0 && (
                  <> · <span className="font-semibold text-success">{formatCurrency(todaySummary.totalValue)}</span> previsto</>
                )}
                {todaySummary.completed > 0 && (
                  <> · <span className="text-success">{todaySummary.completed} concluído{todaySummary.completed !== 1 ? "s" : ""}</span></>
                )}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-0.5">
                Nenhum serviço agendado para hoje
              </p>
            )}
          </div>
        </div>

        {(streak ?? 0) > 1 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 shrink-0 self-start sm:self-auto">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
              {streak} dias consecutivos
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
