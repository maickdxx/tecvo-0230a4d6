import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Activity, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";

interface ReliabilityMetrics {
  total: number;
  webhook: number;
  fallback: number;
  fallbackPercent: number;
  periods: { label: string; total: number; webhook: number; fallback: number; pct: number }[];
}

export function WhatsAppReliabilityPanel() {
  const { organization } = useOrganization();
  const organizationId = organization?.id;
  const [metrics, setMetrics] = useState<ReliabilityMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    fetchMetrics();
  }, [organizationId]);

  async function fetchMetrics() {
    setLoading(true);
    try {
      const now = new Date();
      const h1 = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
      const h6 = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all received messages (not from_me) in last 7 days
      const { data: messages } = await supabase
        .from("whatsapp_messages")
        .select("source, created_at")
        .eq("organization_id", organizationId)
        .eq("is_from_me", false)
        .gte("created_at", d7)
        .order("created_at", { ascending: false });

      const msgs = messages || [];
      const total = msgs.length;
      const webhook = msgs.filter(m => (m as any).source !== "fallback").length;
      const fallback = msgs.filter(m => (m as any).source === "fallback").length;

      const calcPeriod = (since: string, label: string) => {
        const filtered = msgs.filter(m => m.created_at >= since);
        const t = filtered.length;
        const f = filtered.filter(m => (m as any).source === "fallback").length;
        const w = t - f;
        return { label, total: t, webhook: w, fallback: f, pct: t > 0 ? Math.round((f / t) * 100) : 0 };
      };

      setMetrics({
        total,
        webhook,
        fallback,
        fallbackPercent: total > 0 ? Math.round((fallback / total) * 100) : 0,
        periods: [
          calcPeriod(h1, "1h"),
          calcPeriod(h6, "6h"),
          calcPeriod(h24, "24h"),
          calcPeriod(d7, "7d"),
        ],
      });
    } catch (err) {
      console.error("Error fetching reliability metrics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Activity className="h-4 w-4 animate-pulse" />
            Carregando métricas...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const healthStatus = metrics.fallbackPercent > 10 ? "warning" : "healthy";
  const StatusIcon = healthStatus === "warning" ? AlertTriangle : CheckCircle;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Monitoramento de Confiabilidade
          </CardTitle>
          <Badge
            variant="outline"
            className={
              healthStatus === "healthy"
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800"
                : "bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800"
            }
          >
            <StatusIcon className="h-3 w-3 mr-1" />
            {healthStatus === "healthy" ? "Saudável" : "Atenção"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-lg font-bold text-foreground">{metrics.total}</p>
            <p className="text-[11px] text-muted-foreground">Total (7d)</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-emerald-500/5">
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{metrics.webhook}</p>
            <p className="text-[11px] text-muted-foreground">Webhook</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/5">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{metrics.fallback}</p>
            <p className="text-[11px] text-muted-foreground">Fallback</p>
          </div>
        </div>

        {/* Period breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Detalhamento por período
          </p>
          <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {metrics.periods.map((p) => (
              <div key={p.label} className="flex items-center justify-between px-3 py-2 text-xs">
                <span className="font-medium text-foreground w-8">{p.label}</span>
                <span className="text-muted-foreground">{p.total} msgs</span>
                <span className="text-emerald-600 dark:text-emerald-400">{p.webhook} wh</span>
                <span className="text-amber-600 dark:text-amber-400">{p.fallback} fb</span>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 ${
                    p.pct > 10
                      ? "text-amber-700 border-amber-300 dark:text-amber-400"
                      : "text-emerald-700 border-emerald-300 dark:text-emerald-400"
                  }`}
                >
                  {p.pct}% fb
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Alert */}
        {healthStatus === "warning" && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800 dark:text-amber-300">
              <p className="font-medium">Fallback acima de 10%</p>
              <p className="mt-0.5 text-amber-700 dark:text-amber-400">
                O webhook pode estar falhando. Verifique a conexão da instância e os logs do servidor.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
