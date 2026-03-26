import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { useOrgTimezone } from "./useOrgTimezone";
import { getTodayInTz, getLocalDayBoundsUTC, getDatePartInTz } from "@/lib/timezone";
import { toast } from "./use-toast";
import { applyApprovedAdjustments, type ApprovedAdjustment } from "@/lib/timeClockUtils";
import { queueOfflineTimeClock } from "./useOfflineActions";
import { useOffline } from "@/contexts/OfflineContext";

export type TimeClockEntryType = "clock_in" | "break_start" | "break_end" | "clock_out";

export interface TimeClockEntry {
  id: string;
  user_id: string;
  organization_id: string;
  entry_type: TimeClockEntryType;
  recorded_at: string;
  latitude: number | null;
  longitude: number | null;
  device_info: string | null;
  photo_url: string | null;
  hash: string;
  previous_hash: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface TimeClockSettings {
  id: string;
  organization_id: string;
  work_hours_per_day: number;
  min_break_minutes: number;
  late_tolerance_minutes: number;
  geolocation_required: boolean | null;
  allowed_radius_meters: number | null;
  expected_clock_in: string | null;
  work_days: string[];
  overtime_policy: string | null;
  flexible_schedule: boolean | null;
  photo_required: boolean | null;
}

const ENTRY_TYPE_LABELS: Record<TimeClockEntryType, string> = {
  clock_in: "Entrada",
  break_start: "Início de Pausa",
  break_end: "Retorno de Pausa",
  clock_out: "Saída",
};

export function useTimeClock() {
  const { user, profile } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = (profile as any)?.organization_id;
  const { isOnline, refreshPendingCount } = useOffline();

  const isEnabled = !!(organization as any)?.time_clock_enabled;
  const tz = useOrgTimezone();

  // Today's entries for current user — use timezone-aware UTC boundaries
  const today = getTodayInTz(tz);
  const todayBounds = useMemo(() => getLocalDayBoundsUTC(today, tz), [today, tz]);

  const { data: todayEntries = [], isLoading: isLoadingEntries } = useQuery({
    queryKey: ["time-clock-today", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("recorded_at", todayBounds.start)
        .lte("recorded_at", todayBounds.end)
        .order("recorded_at", { ascending: true });

      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!user && isEnabled,
  });

  // Current month entries for current user (for overtime calculation)
  const currentMonthRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const mo = now.getMonth(); // 0-indexed
    const firstDay = `${y}-${String(mo + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(y, mo + 1, 0).getDate();
    const lastDayStr = `${y}-${String(mo + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const startBounds = getLocalDayBoundsUTC(firstDay, tz);
    const endBounds = getLocalDayBoundsUTC(lastDayStr, tz);
    return { start: startBounds.start, end: endBounds.end, key: firstDay };
  }, [tz]);

  const { data: monthEntries = [] } = useQuery({
    queryKey: ["time-clock-month", user?.id, currentMonthRange.key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("recorded_at", currentMonthRange.start)
        .lte("recorded_at", currentMonthRange.end)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!user && isEnabled,
  });

  // Recent entries (last 7 days) for history display only
  const { data: recentEntries = [] } = useQuery({
    queryKey: ["time-clock-recent", user?.id],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("user_id", user!.id)
        .gte("recorded_at", sevenDaysAgo.toISOString())
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!user && isEnabled,
  });

  // Settings
  const { data: settings } = useQuery({
    queryKey: ["time-clock-settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data as TimeClockSettings | null;
    },
    enabled: !!orgId && isEnabled,
  });

  // Approved adjustments for this user
  const { data: myApprovedAdjustments = [] } = useQuery({
    queryKey: ["time-clock-my-approved-adj", user?.id, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("entry_id, new_time, status")
        .eq("organization_id", orgId)
        .eq("status", "approved");
      if (error) throw error;
      return (data || []) as ApprovedAdjustment[];
    },
    enabled: !!user && !!orgId && isEnabled,
  });

  // Effective entries with approved adjustments applied
  const effectiveTodayEntries = useMemo(
    () => applyApprovedAdjustments(todayEntries, myApprovedAdjustments),
    [todayEntries, myApprovedAdjustments]
  );

  const effectiveMonthEntries = useMemo(
    () => applyApprovedAdjustments(monthEntries, myApprovedAdjustments),
    [monthEntries, myApprovedAdjustments]
  );

  // Check if current month is closed for this user
  const { data: monthClosure } = useQuery({
    queryKey: ["time-clock-my-closure", user?.id, orgId, currentMonthRange.key],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("time_clock_month_closures")
        .select("*")
        .eq("organization_id", orgId)
        .eq("user_id", user!.id)
        .eq("month", now.getMonth() + 1)
        .eq("year", now.getFullYear())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!orgId && isEnabled,
  });

  const isMonthClosed = !!(monthClosure as any)?.closed_at && !(monthClosure as any)?.reopened_at;

  // Determine next action — uses original entries (not adjusted) for flow control
  const getNextAction = (): TimeClockEntryType | null => {
    if (isMonthClosed) return null;
    if (todayEntries.length === 0) return "clock_in";
    const last = todayEntries[todayEntries.length - 1];
    switch (last.entry_type) {
      case "clock_in": return "break_start";
      case "break_start": return "break_end";
      case "break_end": return "clock_out";
      case "clock_out": return null;
    }
    return null;
  };

  const getCurrentStatus = (): string => {
    if (isMonthClosed) return "Período fechado";
    if (todayEntries.length === 0) return "Aguardando entrada";
    const last = todayEntries[todayEntries.length - 1];
    switch (last.entry_type) {
      case "clock_in": return "Trabalhando";
      case "break_start": return "Em pausa";
      case "break_end": return "Trabalhando";
      case "clock_out": return "Jornada encerrada";
    }
    return "Aguardando entrada";
  };

  // Allowed transitions for frontend pre-validation (mirrors DB trigger)
  const ALLOWED_TRANSITIONS: Record<TimeClockEntryType, TimeClockEntryType[]> = {
    clock_in: ["break_start", "clock_out"],
    break_start: ["break_end"],
    break_end: ["break_start", "clock_out"],
    clock_out: [],
  };

  // Register entry
  const registerMutation = useMutation({
    mutationFn: async ({ entryType, photoBlob }: { entryType: TimeClockEntryType; photoBlob?: Blob }) => {
      // Block if month is closed
      if (isMonthClosed) {
        throw new Error("O período está fechado. Não é possível registrar ponto.");
      }

      // If clock_out, check for open services
      if (entryType === "clock_out") {
        const { data: openServices, error: svcError } = await supabase
          .from("services")
          .select("id, quote_number")
          .eq("assigned_to", user!.id)
          .in("status", ["in_progress"]);

        if (!svcError && openServices && openServices.length > 0) {
          throw new Error(`Você possui atendimentos em aberto (OS #${openServices.map(s => s.quote_number).join(", ")}). Finalize-os antes de encerrar sua jornada.`);
        }
      }

      // Pre-validate sequence (defense in depth — DB trigger is the authority)
      if (todayEntries.length === 0 && entryType !== "clock_in") {
        throw new Error("Primeiro registro do dia deve ser uma entrada.");
      }
      if (todayEntries.length > 0) {
        const lastType = todayEntries[todayEntries.length - 1].entry_type;
        if (!ALLOWED_TRANSITIONS[lastType]?.includes(entryType)) {
          throw new Error(`Sequência inválida: "${ENTRY_TYPE_LABELS[lastType]}" → "${ENTRY_TYPE_LABELS[entryType]}" não é permitido.`);
        }
      }

      let latitude: number | null = null;
      let longitude: number | null = null;

      if (settings?.geolocation_required) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // Continue without location
        }
      }

      // Upload selfie if provided
      let photo_url: string | null = null;
      if (photoBlob && user && orgId) {
        const fileName = `${orgId}/${user.id}/${Date.now()}.jpg`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("time-clock-photos")
          .upload(fileName, photoBlob, { contentType: "image/jpeg" });
        if (!uploadError && uploadData) {
          // Bucket is private — store the path and generate signed URLs on demand
          photo_url = uploadData.path;
        }
      }

      const { data, error } = await supabase
        .from("time_clock_entries")
        .insert({
          user_id: user!.id,
          organization_id: orgId,
          entry_type: entryType,
          latitude,
          longitude,
          photo_url,
          device_info: navigator.userAgent.substring(0, 100),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-today"] });
      queryClient.invalidateQueries({ queryKey: ["time-clock-recent"] });
      queryClient.invalidateQueries({ queryKey: ["time-clock-month"] });
      const recordedTime = data?.recorded_at
        ? new Date(data.recorded_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      toast({
        title: "✅ Ponto registrado com sucesso!",
        description: `${ENTRY_TYPE_LABELS[variables.entryType]} registrada às ${recordedTime}.`,
      });
    },
    onError: async (error: Error, variables) => {
      // If offline or network error, queue for later sync
      const isNetworkError = !navigator.onLine || 
        error.message?.includes("Failed to fetch") || 
        error.message?.includes("NetworkError") ||
        error.message?.includes("ERR_INTERNET_DISCONNECTED");
      
      if (isNetworkError && user && orgId) {
        await queueOfflineTimeClock({
          entryType: variables.entryType,
          userId: user.id,
          organizationId: orgId,
          refreshPendingCount,
        });
        return;
      }

      toast({
        variant: "destructive",
        title: "Erro ao registrar ponto",
        description: error.message,
      });
    },
  });

  // Calculate worked hours today — uses effective entries (with adjustments applied)
  const getWorkedMinutes = (): number => {
    let totalMinutes = 0;
    let clockInTime: Date | null = null;
    let breakStartTime: Date | null = null;

    for (const entry of effectiveTodayEntries) {
      const time = new Date(entry.recorded_at);
      switch (entry.entry_type) {
        case "clock_in":
          clockInTime = time;
          break;
        case "break_start":
          if (clockInTime) {
            totalMinutes += (time.getTime() - clockInTime.getTime()) / 60000;
            clockInTime = null;
          }
          breakStartTime = time;
          break;
        case "break_end":
          breakStartTime = null;
          clockInTime = time;
          break;
        case "clock_out":
          if (clockInTime) {
            totalMinutes += (time.getTime() - clockInTime.getTime()) / 60000;
            clockInTime = null;
          }
          break;
      }
    }

    // If still working (clocked in, not on break)
    if (clockInTime && !breakStartTime) {
      totalMinutes += (Date.now() - clockInTime.getTime()) / 60000;
    }

    return Math.floor(totalMinutes);
  };

  return {
    isEnabled,
    todayEntries,
    effectiveTodayEntries,
    recentEntries,
    monthEntries,
    effectiveMonthEntries,
    settings,
    isLoadingEntries,
    isMonthClosed,
    nextAction: getNextAction(),
    currentStatus: getCurrentStatus(),
    workedMinutes: getWorkedMinutes(),
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    entryTypeLabels: ENTRY_TYPE_LABELS,
  };
}

// Admin hook for managing all entries — accepts dynamic date range
export function useTimeClockAdmin(dateRange?: { start: string; end: string }) {
  const { profile } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = (profile as any)?.organization_id;
  const tz = useOrgTimezone();

  // Default to current month if no range provided
  const range = useMemo(() => {
    if (dateRange) return dateRange;
    const now = new Date();
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    return { start, end };
  }, [dateRange]);

  // Convert local date range to UTC boundaries for queries
  const utcBounds = useMemo(() => {
    const startBounds = getLocalDayBoundsUTC(range.start, tz);
    const endBounds = getLocalDayBoundsUTC(range.end, tz);
    return { start: startBounds.start, end: endBounds.end };
  }, [range, tz]);

  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ["time-clock-admin", orgId, range.start, range.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_entries")
        .select("*")
        .eq("organization_id", orgId)
        .gte("recorded_at", utcBounds.start)
        .lte("recorded_at", utcBounds.end)
        .order("recorded_at", { ascending: false });

      if (error) throw error;
      return (data || []) as TimeClockEntry[];
    },
    enabled: !!orgId,
  });

  // Approved adjustments for the organization
  const { data: approvedAdjustments = [] } = useQuery({
    queryKey: ["time-clock-approved-adj", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_adjustments")
        .select("entry_id, new_time, status")
        .eq("organization_id", orgId)
        .eq("status", "approved");
      if (error) throw error;
      return (data || []) as ApprovedAdjustment[];
    },
    enabled: !!orgId,
  });

  // Effective entries = raw entries with approved adjustments applied
  const effectiveEntries = useMemo(
    () => applyApprovedAdjustments(allEntries, approvedAdjustments),
    [allEntries, approvedAdjustments]
  );

  // Get team profiles for name resolution
  const { data: teamProfiles = [] } = useQuery({
    queryKey: ["time-clock-team-profiles", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, employee_type, field_worker")
        .eq("organization_id", orgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  // Get user roles to filter ponto-eligible employees
  const { data: userRoles = [] } = useQuery({
    queryKey: ["time-clock-user-roles", orgId],
    queryFn: async () => {
      const userIds = teamProfiles.map(p => p.user_id);
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && teamProfiles.length > 0,
  });

  // Filter to ponto-eligible profiles
  const pontoEligibleProfiles = useMemo(() => {
    const roleMap = new Map<string, string[]>();
    for (const r of userRoles) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    }
    return teamProfiles.filter(p => {
      const roles = roleMap.get(p.user_id) || [];
      const isAdminOrOwner = roles.includes("owner") || roles.includes("admin");
      if (isAdminOrOwner && !p.field_worker) return false;
      return true;
    });
  }, [teamProfiles, userRoles]);

  // Settings management
  const { data: settings } = useQuery({
    queryKey: ["time-clock-settings", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("time_clock_settings")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();

      if (error) throw error;
      return data as TimeClockSettings | null;
    },
    enabled: !!orgId,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<TimeClockSettings>) => {
      if (settings) {
        const { error } = await supabase
          .from("time_clock_settings")
          .update(updates)
          .eq("organization_id", orgId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("time_clock_settings")
          .insert({ organization_id: orgId, ...updates });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-clock-settings"] });
      toast({ title: "Configurações salvas!" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    },
  });

  const toggleTimeClockMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("organizations")
        .update({ time_clock_enabled: enabled } as any)
        .eq("id", orgId);
      if (error) throw error;

      if (enabled && !settings) {
        await supabase.from("time_clock_settings").insert({
          organization_id: orgId,
          work_hours_per_day: 8,
          min_break_minutes: 60,
          late_tolerance_minutes: 10,
          work_days: ["seg", "ter", "qua", "qui", "sex"],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["time-clock-settings"] });
      toast({ title: "Sistema de ponto atualizado!" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    },
  });

  return {
    allEntries,
    effectiveEntries,
    teamProfiles: pontoEligibleProfiles,
    allTeamProfiles: teamProfiles,
    settings,
    isLoading,
    updateSettings: updateSettingsMutation.mutate,
    isUpdatingSettings: updateSettingsMutation.isPending,
    toggleTimeClock: toggleTimeClockMutation.mutate,
    isTogglingTimeClock: toggleTimeClockMutation.isPending,
  };
}
