import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// PT-BR day names matching the rest of the system
const DAY_NAMES = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const EN_TO_PT: Record<string, string> = {
  sun: "dom", mon: "seg", tue: "ter", wed: "qua", thu: "qui", fri: "sex", sat: "sab",
};

function normalizeDayName(day: string): string {
  const lower = day.toLowerCase().trim();
  return EN_TO_PT[lower] || lower;
}

function parseWorkDays(raw: any): string[] {
  let days: string[] = [];
  if (Array.isArray(raw)) days = raw;
  else if (typeof raw === "string") {
    try { days = JSON.parse(raw); } catch { return []; }
  }
  return days.map(normalizeDayName).filter(d => DAY_NAMES.includes(d));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const isCronMode = !body.organization_id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (isCronMode) {
      // Cron mode: process yesterday for ALL orgs with time_clock_enabled
      const targetDate = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      const { data: orgs } = await adminClient
        .from("organizations")
        .select("id")
        .eq("time_clock_enabled", true);

      let totalGenerated = 0;
      for (const org of (orgs || [])) {
        const result = await processOrg(adminClient, org.id, targetDate);
        totalGenerated += result;
      }

      return new Response(JSON.stringify({ mode: "cron", date: targetDate, orgs: (orgs || []).length, generated: totalGenerated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Manual mode: Validate JWT ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerUserId = claimsData.claims.sub as string;
    const orgId = body.organization_id;
    const targetDate = body.date || new Date(Date.now() - 86400000).toISOString().split("T")[0];

    // ---- Validate caller belongs to org and has admin/owner role ----
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("organization_id")
      .eq("user_id", callerUserId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!callerProfile) {
      return new Response(JSON.stringify({ error: "Forbidden: user does not belong to this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUserId);

    const roles = (callerRoles || []).map((r: any) => r.role);
    if (!roles.includes("owner") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Forbidden: insufficient permissions" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Use service role client for data operations ----
    const supabase = adminClient;
    const generated = await processOrg(supabase, orgId, targetDate);

    return new Response(JSON.stringify({
      date: targetDate,
      organization_id: orgId,
      generated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Extracted org processing logic
async function processOrg(supabase: any, orgId: string, targetDate: string): Promise<number> {
    // Get settings
    const { data: settings } = await supabase
      .from("time_clock_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();

    // Get schedules
    const { data: schedules } = await supabase
      .from("time_clock_work_schedules")
      .select("*")
      .eq("organization_id", orgId);

    // Get calendar events
    const { data: calendarEvents } = await supabase
      .from("time_clock_calendar_events")
      .select("*")
      .eq("organization_id", orgId);

    // Get all profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, employee_type, field_worker")
      .eq("organization_id", orgId);

    // Get user roles
    const userIds = (profiles || []).map((p: any) => p.user_id);
    if (userIds.length === 0) return 0;

    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds);

    // Build role map
    const roleMap = new Map<string, string[]>();
    for (const r of (userRoles || [])) {
      if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, []);
      roleMap.get(r.user_id)!.push(r.role);
    }

    // Filter ponto-eligible profiles
    const eligibleProfiles = (profiles || []).filter((p: any) => {
      const uRoles = roleMap.get(p.user_id) || [];
      const isAdminOrOwner = uRoles.includes("owner") || uRoles.includes("admin");
      if (isAdminOrOwner && !p.field_worker) return false;
      return true;
    });

    // Check global holidays
    const globalNonWorkDates = new Set<string>();
    const userNonWorkDates = new Map<string, Set<string>>();
    for (const event of (calendarEvents || [])) {
      const start = new Date(event.start_date + "T12:00:00");
      const end = new Date(event.end_date + "T12:00:00");
      const isGlobal = !event.user_id && ["holiday", "day_off"].includes(event.event_type);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toISOString().split("T")[0];
        if (isGlobal) globalNonWorkDates.add(ds);
        if (event.user_id) {
          if (!userNonWorkDates.has(event.user_id)) userNonWorkDates.set(event.user_id, new Set());
          userNonWorkDates.get(event.user_id)!.add(ds);
        }
      }
    }

    // Get schedule for employee
    function getSchedule(userId: string, employeeType: string) {
      const individual = (schedules || []).find((s: any) => s.user_id === userId);
      if (individual) return individual;
      const typeSchedule = (schedules || []).find((s: any) => !s.user_id && s.employee_type === employeeType);
      if (typeSchedule) return typeSchedule;
      const defaultSchedule = (schedules || []).find((s: any) => s.is_default && !s.user_id && !s.employee_type);
      if (defaultSchedule) return defaultSchedule;
      if (settings) return {
        work_days: settings.work_days,
        expected_clock_in: settings.expected_clock_in || "08:00",
        expected_clock_out: null,
        work_hours_per_day: settings.work_hours_per_day || 8,
        break_minutes: settings.min_break_minutes || 60,
      };
      return null;
    }

    function isWorkDay(dateStr: string, userId: string, employeeType: string): boolean {
      if (globalNonWorkDates.has(dateStr)) return false;
      if (userNonWorkDates.get(userId)?.has(dateStr)) return false;
      const schedule = getSchedule(userId, employeeType);
      if (!schedule) return false;
      const date = new Date(dateStr + "T12:00:00");
      const dayName = DAY_NAMES[date.getDay()];
      const workDays = parseWorkDays(schedule.work_days);
      return workDays.includes(dayName);
    }

    // Get entries for the target date
    const { data: entries } = await supabase
      .from("time_clock_entries")
      .select("*")
      .eq("organization_id", orgId)
      .gte("recorded_at", targetDate + "T00:00:00")
      .lte("recorded_at", targetDate + "T23:59:59")
      .order("recorded_at", { ascending: true });

    // Group entries by user
    const userEntries = new Map<string, any[]>();
    for (const e of (entries || [])) {
      if (!userEntries.has(e.user_id)) userEntries.set(e.user_id, []);
      userEntries.get(e.user_id)!.push(e);
    }

    // Check for existing inconsistencies for this date to avoid duplicates
    const { data: existing } = await supabase
      .from("time_clock_inconsistencies")
      .select("user_id, type")
      .eq("organization_id", orgId)
      .eq("entry_date", targetDate)
      .eq("auto_detected", true);

    const existingSet = new Set((existing || []).map((e: any) => `${e.user_id}|${e.type}`));

    const inconsistencies: any[] = [];
    const toleranceMin = settings?.late_tolerance_minutes ?? 10;

    for (const profile of eligibleProfiles) {
      const userId = profile.user_id;
      const empType = profile.employee_type || "tecnico";

      if (!isWorkDay(targetDate, userId, empType)) continue;

      const schedule = getSchedule(userId, empType);
      if (!schedule) continue;

      const userEnts = userEntries.get(userId) || [];

      // Missing clock_in
      if (userEnts.length === 0) {
        const key = `${userId}|missing_clock_in`;
        if (!existingSet.has(key)) {
          inconsistencies.push({
            organization_id: orgId,
            user_id: userId,
            entry_date: targetDate,
            type: "missing_clock_in",
            description: "Nenhum registro de entrada no dia previsto",
            severity: "high",
            auto_detected: true,
          });
        }
        continue;
      }

      const sorted = [...userEnts].sort((a: any, b: any) => a.recorded_at.localeCompare(b.recorded_at));
      const last = sorted[sorted.length - 1];
      const first = sorted[0];

      // Missing clock_out
      if (last.entry_type !== "clock_out") {
        const key = `${userId}|missing_clock_out`;
        if (!existingSet.has(key)) {
          inconsistencies.push({
            organization_id: orgId,
            user_id: userId,
            entry_date: targetDate,
            type: "missing_clock_out",
            description: "Jornada aberta sem registro de saída",
            severity: "high",
            auto_detected: true,
          });
        }
      }

      // Late arrival
      if (first.entry_type === "clock_in" && schedule.expected_clock_in) {
        const entryTime = new Date(first.recorded_at);
        const clockIn = schedule.expected_clock_in.toString();
        const [h, m] = clockIn.split(":").map(Number);
        const expectedWithTolerance = new Date(entryTime);
        expectedWithTolerance.setHours(h, m + toleranceMin, 0, 0);
        
        if (entryTime > expectedWithTolerance) {
          const key = `${userId}|late_arrival`;
          if (!existingSet.has(key)) {
            const expectedExact = new Date(entryTime);
            expectedExact.setHours(h, m, 0, 0);
            const lateMins = Math.floor((entryTime.getTime() - expectedExact.getTime()) / 60000);
            inconsistencies.push({
              organization_id: orgId,
              user_id: userId,
              entry_date: targetDate,
              type: "late_arrival",
              description: `Entrada com ${lateMins} minutos de atraso`,
              severity: lateMins > 30 ? "high" : "medium",
              auto_detected: true,
            });
          }
        }
      }

      // Short break
      const breakMinRequired = schedule.break_minutes || schedule.min_break_minutes || 60;
      let breakStart: Date | null = null;
      for (const e of sorted) {
        if (e.entry_type === "break_start") breakStart = new Date(e.recorded_at);
        if (e.entry_type === "break_end" && breakStart) {
          const breakMin = (new Date(e.recorded_at).getTime() - breakStart.getTime()) / 60000;
          if (breakMin < breakMinRequired) {
            const key = `${userId}|short_break`;
            if (!existingSet.has(key)) {
              inconsistencies.push({
                organization_id: orgId,
                user_id: userId,
                entry_date: targetDate,
                type: "short_break",
                description: `Intervalo de ${Math.floor(breakMin)} min (mínimo: ${breakMinRequired} min)`,
                severity: "medium",
                auto_detected: true,
              });
            }
          }
          breakStart = null;
        }
      }

      // Incomplete break
      const types = sorted.map((e: any) => e.entry_type);
      const breakStarts = types.filter((t: string) => t === "break_start").length;
      const breakEnds = types.filter((t: string) => t === "break_end").length;
      if (breakStarts > breakEnds) {
        const key = `${userId}|incomplete_break`;
        if (!existingSet.has(key)) {
          inconsistencies.push({
            organization_id: orgId,
            user_id: userId,
            entry_date: targetDate,
            type: "incomplete_break",
            description: "Intervalo iniciado mas não encerrado",
            severity: "medium",
            auto_detected: true,
          });
        }
      }

      // Early departure
      if (last.entry_type === "clock_out" && schedule.expected_clock_out) {
        const exitTime = new Date(last.recorded_at);
        const clockOut = schedule.expected_clock_out.toString();
        const [oh, om] = clockOut.split(":").map(Number);
        const expectedExitWithTolerance = new Date(exitTime);
        expectedExitWithTolerance.setHours(oh, om - toleranceMin, 0, 0);
        
        if (exitTime < expectedExitWithTolerance) {
          const key = `${userId}|early_departure`;
          if (!existingSet.has(key)) {
            const expectedExact = new Date(exitTime);
            expectedExact.setHours(oh, om, 0, 0);
            const earlyMins = Math.floor((expectedExact.getTime() - exitTime.getTime()) / 60000);
            inconsistencies.push({
              organization_id: orgId,
              user_id: userId,
              entry_date: targetDate,
              type: "early_departure",
              description: `Saída ${earlyMins} minutos antes do previsto`,
              severity: earlyMins > 30 ? "high" : "medium",
              auto_detected: true,
            });
          }
        }
      }
    }

    // Insert new inconsistencies
    if (inconsistencies.length > 0) {
      const { error: insertError } = await supabase
        .from("time_clock_inconsistencies")
        .insert(inconsistencies);
      if (insertError) throw insertError;
    }

    return inconsistencies.length;
}
