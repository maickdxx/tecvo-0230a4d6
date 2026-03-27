import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeInTz, formatDateTimeInTz, formatDateInTz, buildTimestamp, getDatePartInTz, getTodayInTz } from "@/lib/timezone";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Clock, AlertCircle, History, Timer, UserX, Eye, Pencil, Loader2, Plus } from "lucide-react";

interface Inconsistency {
  id: string;
  user_id: string;
  entry_date: string;
  type: string;
  description: string | null;
  status: string;
  review_note: string | null;
  reviewed_by: string | null;
  severity: string;
  auto_detected: boolean;
  created_at: string;
}

interface Adjustment {
  id: string;
  entry_id: string;
  organization_id: string;
  adjusted_by: string;
  requested_by: string | null;
  adjustment_type: string;
  original_time: string | null;
  new_time: string | null;
  reason: string;
  request_reason: string | null;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

interface EntryInfo {
  id: string;
  user_id: string;
  entry_type: string;
  recorded_at: string;
}

const entryTypeLabels: Record<string, string> = {
  clock_in: "Entrada",
  break_start: "Início de Pausa",
  break_end: "Retorno de Pausa",
  clock_out: "Saída",
};

export default function PontoAjustes() {
  const { profile } = useAuth();
  const tz = useOrgTimezone();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [detailAdj, setDetailAdj] = useState<Adjustment | null>(null);
  const [editTime, setEditTime] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [adjRejectNote, setAdjRejectNote] = useState("");

  // Proactive adjustment state
  const [proactiveOpen, setProactiveOpen] = useState(false);
  const [proactiveUserId, setProactiveUserId] = useState("");
  const [proactiveEntryId, setProactiveEntryId] = useState("");
  const [proactiveNewTime, setProactiveNewTime] = useState("");
  const [proactiveReason, setProactiveReason] = useState("");
  const [isSubmittingProactive, setIsSubmittingProactive] = useState(false);

  // Fetch inconsistencies
  const { data: inconsistencies = [] } = useQuery({
    queryKey: ["time-clock-inconsistencies", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_inconsistencies")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Inconsistency[];
    },
    enabled: !!orgId,
  });

  // Fetch adjustments
  const { data: adjustments = [], isLoading: isLoadingAdj } = useQuery({
    queryKey: ["time-clock-adjustments", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as Adjustment[];
    },
    enabled: !!orgId,
  });

  // Fetch related entries for adjustments
  const entryIds = useMemo(() => [...new Set(adjustments.map(a => a.entry_id))], [adjustments]);
  const { data: entries = [] } = useQuery({
    queryKey: ["time-clock-adj-entries", entryIds],
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("id, user_id, entry_type, recorded_at")
        .in("id", entryIds);
      if (error) throw error;
      return (data || []) as EntryInfo[];
    },
    enabled: entryIds.length > 0,
  });

  const entryMap = useMemo(() => {
    const m = new Map<string, EntryInfo>();
    for (const e of entries) m.set(e.id, e);
    return m;
  }, [entries]);

  // Fetch profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ["time-clock-team-profiles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("organization_id", orgId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const nameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles) m.set(p.user_id, p.full_name || "Sem nome");
    return m;
  }, [profiles]);

  // All recent entries for proactive adjustment (manager picks employee + entry)
  const { data: allRecentEntries = [] } = useQuery({
    queryKey: ["time-clock-all-entries-for-adj", orgId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("id, user_id, entry_type, recorded_at")
        .eq("organization_id", orgId)
        .gte("recorded_at", thirtyDaysAgo.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as EntryInfo[];
    },
    enabled: !!orgId && proactiveOpen,
  });

  // Filter entries by selected user for proactive dialog
  const proactiveUserEntries = useMemo(() => {
    if (!proactiveUserId) return [];
    return allRecentEntries.filter(e => e.user_id === proactiveUserId);
  }, [allRecentEntries, proactiveUserId]);

  // Submit proactive adjustment
  const submitProactiveAdjustment = async () => {
    if (!proactiveEntryId || !proactiveReason.trim() || !proactiveNewTime || !profile?.user_id || !orgId) {
      toast({ variant: "destructive", title: "Preencha todos os campos", description: "Selecione o registro, informe o novo horário e a justificativa." });
      return;
    }
    setIsSubmittingProactive(true);
    try {
      const entry = allRecentEntries.find(e => e.id === proactiveEntryId);
      if (!entry) throw new Error("Registro não encontrado");

      const dateStr = getDatePartInTz(entry.recorded_at, tz);
      const newTimeISO = buildTimestamp(dateStr, proactiveNewTime, tz);

      const { error } = await supabase.from("time_clock_adjustments").insert({
        entry_id: proactiveEntryId,
        organization_id: orgId,
        adjusted_by: profile.user_id,
        requested_by: profile.user_id,
        adjustment_type: "manager_correction",
        original_time: entry.recorded_at,
        new_time: newTimeISO,
        reason: `Tipo: ${entryTypeLabels[entry.entry_type] || entry.entry_type}`,
        request_reason: proactiveReason.trim(),
        status: "approved",
        approved_by: profile.user_id,
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["time-clock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-adjustments-count"] });
      toast({ title: "Ajuste aplicado com sucesso!", description: "O horário foi corrigido e já está em vigor." });
      setProactiveOpen(false);
      setProactiveUserId("");
      setProactiveEntryId("");
      setProactiveNewTime("");
      setProactiveReason("");
    } catch (err: any) {
      toast({ variant: "destructive", title: "Erro", description: err.message });
    } finally {
      setIsSubmittingProactive(false);
    }
  };

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      const { error } = await supabase
        .from("time_clock_inconsistencies")
        .update({
          status,
          review_note: note || null,
          reviewed_by: profile?.user_id,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-inconsistencies"] });
      queryClient.invalidateQueries({ queryKey: ["pending-adjustments-count"] });
      toast({ title: "Inconsistência atualizada!" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  // Adjustment approve/reject mutation
  const adjMutation = useMutation({
    mutationFn: async ({ id, status, note, newTime }: { id: string; status: "approved" | "rejected"; note?: string; newTime?: string }) => {
      const updateData: Record<string, any> = {
        status,
        approved_by: profile?.user_id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (note) updateData.reason = (adjustments.find(a => a.id === id)?.reason || "") + "\n[Gestor]: " + note;
      if (newTime) updateData.new_time = newTime;

      const { error } = await supabase
        .from("time_clock_adjustments")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;

      // If approved, update the time_clock_entry's recorded_at
      if (status === "approved") {
        const adj = adjustments.find(a => a.id === id);
        if (adj) {
          const finalTime = newTime || adj.new_time;
          if (finalTime) {
            // We can't directly update immutable entries, so the adjustment record itself
            // serves as the approved correction. The entry stays as-is for audit trail.
            // The espelho/reports should read approved adjustments to show corrected times.
          }
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["pending-adjustments-count"] });
      toast({ title: vars.status === "approved" ? "Ajuste aprovado!" : "Ajuste rejeitado!" });
      setDetailAdj(null);
      setEditMode(false);
      setAdjRejectNote("");
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  const pendingInconsistencies = inconsistencies.filter(i => i.status === "pending");
  const resolvedInconsistencies = inconsistencies.filter(i => i.status !== "pending");
  const pendingAdjustments = adjustments.filter(a => a.status === "pending");
  const resolvedAdjustments = adjustments.filter(a => a.status !== "pending");
  const pendingTotal = pendingInconsistencies.length + pendingAdjustments.length;

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    resolved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente", approved: "Aprovado", rejected: "Rejeitado", resolved: "Resolvido",
  };

  const severityColors: Record<string, string> = {
    low: "text-blue-600", medium: "text-amber-600", high: "text-red-600",
  };

  const typeLabels: Record<string, string> = {
    missing_clock_out: "Sem saída",
    incomplete_break: "Intervalo incompleto",
    late_arrival: "Atraso",
    early_departure: "Saída antecipada",
    missing_clock_in: "Sem entrada",
    short_break: "Intervalo curto",
  };

  const typeIcons: Record<string, typeof AlertCircle> = {
    missing_clock_out: Timer,
    missing_clock_in: UserX,
    late_arrival: Clock,
    incomplete_break: Clock,
    short_break: Clock,
    early_departure: Clock,
  };

  const formatTime = (iso: string | null) => {
    return formatDateTimeInTz(iso, tz);
  };

  const formatTimeOnly = (iso: string | null) => {
    if (!iso) return "—";
    return formatTimeInTz(iso, tz);
  };

  const openDetail = (adj: Adjustment) => {
    setDetailAdj(adj);
    setEditMode(false);
    const displayTime = adj.new_time ? formatTimeOnly(adj.new_time) : "";
    setEditTime(displayTime !== "—" ? displayTime : "");
    setAdjRejectNote("");
  };

  // Adjustment card with full info and actions
  const AdjustmentCard = ({ adj, showActions }: { adj: Adjustment; showActions: boolean }) => {
    const entry = entryMap.get(adj.entry_id);
    const employeeName = entry ? nameMap.get(entry.user_id) : nameMap.get(adj.requested_by || adj.adjusted_by);
    
    return (
      <div className="border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{employeeName || "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              Solicitado em {formatTime(adj.created_at)}
            </p>
          </div>
          <Badge className={`${statusColors[adj.status] || "bg-muted"} text-[11px] shrink-0`}>
            {statusLabels[adj.status] || adj.status}
          </Badge>
        </div>

        {/* Entry info */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Tipo: </span>
            <span className="font-medium">{entry ? (entryTypeLabels[entry.entry_type] || entry.entry_type) : adj.reason?.replace("Tipo: ", "") || "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Data: </span>
            <span className="font-medium">{entry ? formatDateInTz(entry.recorded_at, tz) : "—"}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Original: </span>
            <span className="font-medium">{formatTimeOnly(adj.original_time)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Solicitado: </span>
            <span className="font-medium text-primary">{formatTimeOnly(adj.new_time)}</span>
          </div>
        </div>

        {/* Reason */}
        {adj.request_reason && (
          <div className="text-xs">
            <span className="text-muted-foreground">Justificativa: </span>
            <span>{adj.request_reason}</span>
          </div>
        )}

        {/* Actions */}
        {showActions && adj.status === "pending" && (
          <div className="flex gap-2 pt-2 border-t border-border">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={() => adjMutation.mutate({ id: adj.id, status: "approved" })}
              disabled={adjMutation.isPending}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => openDetail(adj)}
              disabled={adjMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Recusar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openDetail(adj)}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Resolved info */}
        {adj.status !== "pending" && (
          <div className="text-[10px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
            {adj.approved_by && (
              <p>{adj.status === "approved" ? "Aprovado" : "Rejeitado"} por: {nameMap.get(adj.approved_by) || "—"}</p>
            )}
            {adj.approved_at && (
              <p>Em: {formatTime(adj.approved_at)}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const InconsistencyCard = ({ inc, showActions }: { inc: Inconsistency; showActions: boolean }) => {
    const TypeIcon = typeIcons[inc.type] || AlertCircle;
    return (
      <div className="border border-border rounded-lg p-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-medium text-sm">{nameMap.get(inc.user_id) || "—"}</p>
            <p className="text-[11px] text-muted-foreground">{formatDateInTz(inc.entry_date + "T12:00:00Z", tz)}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {inc.severity && (
              <span className={`text-[10px] font-medium uppercase ${severityColors[inc.severity] || ""}`}>
                {inc.severity}
              </span>
            )}
            <Badge className={`${statusColors[inc.status] || "bg-muted"} text-[11px]`}>
              {statusLabels[inc.status] || inc.status}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Badge variant="outline" className="text-[11px] flex items-center gap-1">
            <TypeIcon className="h-3 w-3" />
            {typeLabels[inc.type] || inc.type}
          </Badge>
          {inc.auto_detected && <Badge variant="secondary" className="text-[10px]">Auto-detectado</Badge>}
        </div>
        {inc.description && <p className="text-xs text-muted-foreground mb-2">{inc.description}</p>}
        {showActions && inc.status === "pending" && (
          <div className="space-y-2 pt-2 border-t border-border">
            <Textarea
              placeholder="Observação (opcional)..."
              value={reviewNote[inc.id] || ""}
              onChange={e => setReviewNote(prev => ({ ...prev, [inc.id]: e.target.value }))}
              className="min-h-[40px] text-xs"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={() => reviewMutation.mutate({ id: inc.id, status: "resolved", note: reviewNote[inc.id] })}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Resolver
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                onClick={() => reviewMutation.mutate({ id: inc.id, status: "rejected", note: reviewNote[inc.id] })}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Rejeitar
              </Button>
            </div>
          </div>
        )}
        {inc.status !== "pending" && inc.review_note && (
          <p className="text-xs text-muted-foreground mt-1 italic">Obs: {inc.review_note}</p>
        )}
        {inc.status !== "pending" && inc.reviewed_by && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Revisado por: {nameMap.get(inc.reviewed_by) || "—"}
          </p>
        )}
      </div>
    );
  };

  // Detail modal
  const detailEntry = detailAdj ? entryMap.get(detailAdj.entry_id) : null;
  const detailEmployee = detailEntry
    ? nameMap.get(detailEntry.user_id)
    : detailAdj
      ? nameMap.get(detailAdj.requested_by || detailAdj.adjusted_by)
      : null;

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Ajustes e Inconsistências</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie solicitações de ajuste de ponto e inconsistências
              {pendingTotal > 0 && <Badge variant="destructive" className="ml-2">{pendingTotal} pendentes</Badge>}
            </p>
          </div>
          <Button size="sm" onClick={() => setProactiveOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Criar Ajuste
          </Button>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending" className="text-sm">
              Pendências {pendingTotal > 0 && <Badge variant="destructive" className="ml-1.5 text-[10px]">{pendingTotal}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-sm">
              <History className="h-3.5 w-3.5 mr-1" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3 mt-3">
            {pendingAdjustments.length === 0 && pendingInconsistencies.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  <p className="text-sm">Nenhuma pendência encontrada</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Adjustments section FIRST — these are employee requests needing action */}
                {pendingAdjustments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Solicitações de Ajuste ({pendingAdjustments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                      <div className="space-y-3">
                        {pendingAdjustments.map(adj => (
                          <AdjustmentCard key={adj.id} adj={adj} showActions={true} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {pendingInconsistencies.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        Inconsistências ({pendingInconsistencies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                      <div className="space-y-3">
                        {pendingInconsistencies.map(inc => (
                          <InconsistencyCard key={inc.id} inc={inc} showActions={true} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3 mt-3">
            {resolvedAdjustments.length === 0 && resolvedInconsistencies.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                  <p className="text-sm">Nenhum histórico encontrado</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {resolvedAdjustments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Histórico de Ajustes ({resolvedAdjustments.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                      <div className="space-y-3">
                        {resolvedAdjustments.map(adj => (
                          <AdjustmentCard key={adj.id} adj={adj} showActions={false} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {resolvedInconsistencies.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        Inconsistências Resolvidas ({resolvedInconsistencies.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
                      <div className="space-y-3">
                        {resolvedInconsistencies.map(inc => (
                          <InconsistencyCard key={inc.id} inc={inc} showActions={false} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Detail / Action Modal */}
      <Dialog open={!!detailAdj} onOpenChange={(open) => { if (!open) setDetailAdj(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          {detailAdj && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Colaborador</p>
                  <p className="font-medium">{detailEmployee || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Status</p>
                  <Badge className={`${statusColors[detailAdj.status] || "bg-muted"} text-xs`}>
                    {statusLabels[detailAdj.status] || detailAdj.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Tipo do Registro</p>
                  <p className="font-medium">
                    {detailEntry ? (entryTypeLabels[detailEntry.entry_type] || detailEntry.entry_type) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Data</p>
                  <p className="font-medium">
                    {detailEntry ? formatDateInTz(detailEntry.recorded_at, tz) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Horário Original</p>
                  <p className="font-medium">{formatTimeOnly(detailAdj.original_time)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Horário Solicitado</p>
                  <p className="font-medium text-primary">{formatTimeOnly(detailAdj.new_time)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Justificativa do Colaborador</p>
                  <p className="font-medium">{detailAdj.request_reason || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs">Solicitado em</p>
                  <p className="font-medium">{formatTime(detailAdj.created_at)}</p>
                </div>
                {detailAdj.approved_by && (
                  <>
                    <div>
                      <p className="text-muted-foreground text-xs">Decisão por</p>
                      <p className="font-medium">{nameMap.get(detailAdj.approved_by) || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data da Decisão</p>
                      <p className="font-medium">{formatTime(detailAdj.approved_at)}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Edit time option */}
              {detailAdj.status === "pending" && (
                <div className="space-y-3 pt-3 border-t border-border">
                  {editMode && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Ajustar horário manualmente</label>
                      <Input
                        type="time"
                        value={editTime}
                        onChange={e => setEditTime(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Observação do gestor</label>
                    <Textarea
                      placeholder="Observação (obrigatória para rejeição)..."
                      value={adjRejectNote}
                      onChange={e => setAdjRejectNote(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        const newTime = editMode && editTime 
                          ? (() => {
                              const dateStr = detailEntry ? getDatePartInTz(detailEntry.recorded_at, tz) : getTodayInTz(tz);
                              return buildTimestamp(dateStr, editTime, tz);
                            })()
                          : undefined;
                        adjMutation.mutate({ 
                          id: detailAdj.id, 
                          status: "approved", 
                          note: adjRejectNote || undefined,
                          newTime 
                        });
                      }}
                      disabled={adjMutation.isPending}
                    >
                      {adjMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                      {editMode ? "Aprovar com Edição" : "Aprovar"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => {
                        if (!adjRejectNote.trim()) {
                          toast({ variant: "destructive", title: "Observação obrigatória", description: "Informe o motivo da rejeição." });
                          return;
                        }
                        adjMutation.mutate({ id: detailAdj.id, status: "rejected", note: adjRejectNote });
                      }}
                      disabled={adjMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Recusar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditMode(!editMode)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      {editMode ? "Cancelar Edição" : "Editar Horário"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Proactive Adjustment Dialog — Manager creates adjustment directly */}
      <Dialog open={proactiveOpen} onOpenChange={(open) => { if (!open) { setProactiveOpen(false); setProactiveUserId(""); setProactiveEntryId(""); setProactiveNewTime(""); setProactiveReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Criar Ajuste de Ponto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Funcionário</label>
              <Select value={proactiveUserId} onValueChange={(v) => { setProactiveUserId(v); setProactiveEntryId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o funcionário" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {proactiveUserId && (
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Registro a ajustar</label>
                <Select value={proactiveEntryId} onValueChange={setProactiveEntryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o registro" /></SelectTrigger>
                  <SelectContent>
                    {proactiveUserEntries.length === 0 ? (
                      <SelectItem value="none" disabled>Nenhum registro encontrado</SelectItem>
                    ) : (
                      proactiveUserEntries.map(e => (
                        <SelectItem key={e.id} value={e.id}>
                          {formatDateInTz(e.recorded_at, tz)} — {entryTypeLabels[e.entry_type] || e.entry_type} — {formatTimeInTz(e.recorded_at, tz)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {proactiveEntryId && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Novo horário</label>
                  <Input type="time" value={proactiveNewTime} onChange={e => setProactiveNewTime(e.target.value)} className="w-40" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Justificativa (obrigatória)</label>
                  <Textarea
                    placeholder="Informe o motivo do ajuste..."
                    value={proactiveReason}
                    onChange={e => setProactiveReason(e.target.value)}
                    className="min-h-[80px] text-sm"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProactiveOpen(false)}>Cancelar</Button>
            <Button
              onClick={submitProactiveAdjustment}
              disabled={isSubmittingProactive || !proactiveEntryId || !proactiveNewTime || !proactiveReason.trim()}
            >
              {isSubmittingProactive ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              Aplicar Ajuste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
