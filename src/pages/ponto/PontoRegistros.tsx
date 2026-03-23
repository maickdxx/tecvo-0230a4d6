import { useState, useMemo } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin, type TimeClockEntryType } from "@/hooks/useTimeClock";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeWithSecondsInTz, formatDateInTz, getDatePartInTz } from "@/lib/timezone";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Smartphone, Wifi, Edit3 } from "lucide-react";

const ENTRY_LABELS: Record<TimeClockEntryType, string> = {
  clock_in: "Entrada",
  break_start: "Início Pausa",
  break_end: "Retorno Pausa",
  clock_out: "Saída",
};

const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  tecnico: "Técnico",
  ajudante: "Ajudante",
  atendente: "Atendente",
};

const ENTRY_COLORS: Record<string, string> = {
  clock_in: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  break_start: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  break_end: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  clock_out: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function PontoRegistros() {
  const tz = useOrgTimezone();
  const { allEntries, teamProfiles, settings, isLoading } = useTimeClockAdmin();
  const [filterUser, setFilterUser] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterEntryType, setFilterEntryType] = useState("all");
  const [searchName, setSearchName] = useState("");

  const expectedClockIn = settings?.expected_clock_in ?? "08:00";
  const toleranceMin = settings?.late_tolerance_minutes ?? 10;

  const profileMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string; fieldWorker: boolean }>();
    for (const p of teamProfiles) {
      map.set(p.user_id, {
        name: p.full_name || "Sem nome",
        type: (p as any).employee_type || "tecnico",
        fieldWorker: !!(p as any).field_worker,
      });
    }
    return map;
  }, [teamProfiles]);

  // Build journey status per user per day (using timezone-aware date)
  const journeyStatus = useMemo(() => {
    const map = new Map<string, string>(); // key: userId|date
    const grouped = new Map<string, typeof allEntries>();
    for (const e of allEntries) {
      const date = getDatePartInTz(e.recorded_at, tz);
      const key = `${e.user_id}|${date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }
    for (const [key, entries] of grouped) {
      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const last = sorted[sorted.length - 1];
      const hasClockOut = sorted.some(e => e.entry_type === "clock_out");
      
      if (hasClockOut) map.set(key, "Completa");
      else if (last.entry_type === "break_start") map.set(key, "Em Pausa");
      else map.set(key, "Aberta");
    }
    return map;
  }, [allEntries, tz]);

  const filteredEntries = useMemo(() => {
    return allEntries.filter(e => {
      if (filterUser !== "all" && e.user_id !== filterUser) return false;
      if (filterDate && getDatePartInTz(e.recorded_at, tz) !== filterDate) return false;
      if (filterType !== "all") {
        const profile = profileMap.get(e.user_id);
        if (profile?.type !== filterType) return false;
      }
      if (filterEntryType !== "all" && e.entry_type !== filterEntryType) return false;
      if (searchName) {
        const name = profileMap.get(e.user_id)?.name || "";
        if (!name.toLowerCase().includes(searchName.toLowerCase())) return false;
      }
      return true;
    });
  }, [allEntries, filterUser, filterDate, filterType, filterEntryType, searchName, profileMap, tz]);

  const formatTime = (iso: string) => {
    return formatTimeWithSecondsInTz(iso, tz);
  };

  const getDeviceLabel = (deviceInfo: string | null) => {
    if (!deviceInfo) return null;
    if (deviceInfo.includes("Mobile") || deviceInfo.includes("Android") || deviceInfo.includes("iPhone")) return "Mobile";
    return "Desktop";
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Registros de Ponto</h1>
          <p className="text-sm text-muted-foreground">Todos os registros de ponto da equipe ({filteredEntries.length} registros)</p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar funcionário..." value={searchName} onChange={e => setSearchName(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger><SelectValue placeholder="Funcionário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {teamProfiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || "Sem nome"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Cargo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os cargos</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
              <SelectItem value="ajudante">Ajudante</SelectItem>
              <SelectItem value="atendente">Atendente</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterEntryType} onValueChange={setFilterEntryType}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="clock_in">Entrada</SelectItem>
              <SelectItem value="break_start">Início Pausa</SelectItem>
              <SelectItem value="break_end">Retorno Pausa</SelectItem>
              <SelectItem value="clock_out">Saída</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
        </div>

        {/* Records */}
        <div className="space-y-2">
          {isLoading ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : filteredEntries.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhum registro encontrado</CardContent></Card>
          ) : (
            filteredEntries.slice(0, 200).map(entry => {
              const profile = profileMap.get(entry.user_id);
              const date = getDatePartInTz(entry.recorded_at, tz);
              const journeyKey = `${entry.user_id}|${date}`;
              const journey = journeyStatus.get(journeyKey) || "—";
              const device = getDeviceLabel(entry.device_info);

              return (
                <Card key={entry.id}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{profile?.name || "—"}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[11px]">{EMPLOYEE_TYPE_LABELS[profile?.type || "tecnico"]}</Badge>
                          <Badge className={`text-[11px] ${ENTRY_COLORS[entry.entry_type] || ""}`}>
                            {ENTRY_LABELS[entry.entry_type]}
                          </Badge>
                          <Badge variant="secondary" className="text-[11px]">
                            {journey === "Completa" ? "✅" : journey === "Aberta" ? "🔓" : "⏸️"} {journey}
                          </Badge>
                        </div>
                        
                        {/* Context info */}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                          {entry.latitude && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              <span>{entry.latitude.toFixed(4)}, {entry.longitude?.toFixed(4)}</span>
                            </div>
                          )}
                          {profile?.fieldWorker && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <MapPin className="h-3 w-3" />
                              <span>Campo</span>
                            </div>
                          )}
                          {device && (
                            <div className="flex items-center gap-1">
                              <Smartphone className="h-3 w-3" />
                              <span>{device}</span>
                            </div>
                          )}
                          {entry.ip_address && (
                            <div className="flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              <span>{entry.ip_address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-mono font-medium">{formatTime(entry.recorded_at)}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateInTz(entry.recorded_at, tz)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
