import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { useTimeClockAdmin, type TimeClockEntryType } from "@/hooks/useTimeClock";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatTimeInTz, getTodayInTz, formatDateInTz } from "@/lib/timezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Users, AlertTriangle, TrendingUp, Search } from "lucide-react";

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

export default function PontoAdmin() {
  const { allEntries, teamProfiles, isLoading } = useTimeClockAdmin();
  const tz = useOrgTimezone();
  const [tab, setTab] = useState("registros");
  const [filterUser, setFilterUser] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [searchName, setSearchName] = useState("");

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

  const filteredEntries = useMemo(() => {
    return allEntries.filter(e => {
      if (filterUser !== "all" && e.user_id !== filterUser) return false;
      if (filterDate && !e.recorded_at.startsWith(filterDate)) return false;
      if (searchName) {
        const name = profileMap.get(e.user_id)?.name || "";
        if (!name.toLowerCase().includes(searchName.toLowerCase())) return false;
      }
      return true;
    });
  }, [allEntries, filterUser, filterDate, searchName, profileMap]);

  // Summary stats
  const todayStr = getTodayInTz(tz);
  const todayEntries = allEntries.filter(e => e.recorded_at.startsWith(todayStr));
  const uniqueTodayUsers = new Set(todayEntries.map(e => e.user_id));
  const clockedInToday = uniqueTodayUsers.size;
  const totalTeam = teamProfiles.length;
  // Note: This page shows raw data, schedule-aware logic is in PontoDashboard
  const absentToday = totalTeam - clockedInToday;

  // Compute per-user day summaries for espelho de ponto
  const dailySummaries = useMemo(() => {
    const summaries: Array<{
      userId: string;
      name: string;
      type: string;
      date: string;
      clockIn: string | null;
      clockOut: string | null;
      breakMinutes: number;
      workedMinutes: number;
      entries: typeof allEntries;
    }> = [];

    // Group by user+date
    const grouped = new Map<string, typeof allEntries>();
    for (const e of filteredEntries) {
      const date = e.recorded_at.split("T")[0];
      const key = `${e.user_id}|${date}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    for (const [key, entries] of grouped) {
      const [userId, date] = key.split("|");
      const sorted = [...entries].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      const profile = profileMap.get(userId);

      let workedMinutes = 0;
      let breakMinutes = 0;
      let clockIn: Date | null = null;
      let breakStart: Date | null = null;
      let firstClockIn: string | null = null;
      let lastClockOut: string | null = null;

      for (const e of sorted) {
        const t = new Date(e.recorded_at);
        switch (e.entry_type) {
          case "clock_in":
            clockIn = t;
            if (!firstClockIn) firstClockIn = e.recorded_at;
            break;
          case "break_start":
            if (clockIn) {
              workedMinutes += (t.getTime() - clockIn.getTime()) / 60000;
              clockIn = null;
            }
            breakStart = t;
            break;
          case "break_end":
            if (breakStart) {
              breakMinutes += (t.getTime() - breakStart.getTime()) / 60000;
              breakStart = null;
            }
            clockIn = t;
            break;
          case "clock_out":
            if (clockIn) {
              workedMinutes += (t.getTime() - clockIn.getTime()) / 60000;
              clockIn = null;
            }
            lastClockOut = e.recorded_at;
            break;
        }
      }

      summaries.push({
        userId,
        name: profile?.name || "Sem nome",
        type: profile?.type || "tecnico",
        date,
        clockIn: firstClockIn,
        clockOut: lastClockOut,
        breakMinutes: Math.floor(breakMinutes),
        workedMinutes: Math.floor(workedMinutes),
        entries: sorted,
      });
    }

    return summaries.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
  }, [filteredEntries, profileMap]);

  const formatTime = (iso: string | null) => {
    return formatTimeInTz(iso, tz);
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Controle de Ponto</h1>
          <p className="text-sm text-muted-foreground">Acompanhamento e gestão do ponto da equipe</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{clockedInToday}</p>
                <p className="text-xs text-muted-foreground">Presentes hoje</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-red-100 dark:bg-red-900/30 p-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{absentToday}</p>
                <p className="text-xs text-muted-foreground">Ausentes hoje</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayEntries.length}</p>
                <p className="text-xs text-muted-foreground">Registros hoje</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalTeam}</p>
                <p className="text-xs text-muted-foreground">Total da equipe</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="registros">Registros</TabsTrigger>
            <TabsTrigger value="espelho">Espelho de Ponto</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar funcionário..."
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterUser} onValueChange={setFilterUser}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Funcionário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {teamProfiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>
                  {p.full_name || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="w-full sm:w-[180px]"
          />
        </div>

        {/* Content */}
        {tab === "registros" ? (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Registro</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Localização</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                    ) : filteredEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                    ) : (
                      filteredEntries.slice(0, 100).map(entry => {
                        const profile = profileMap.get(entry.user_id);
                        const time = new Date(entry.recorded_at);
                        return (
                          <TableRow key={entry.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{profile?.name || "—"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {EMPLOYEE_TYPE_LABELS[profile?.type || "tecnico"]}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {ENTRY_LABELS[entry.entry_type]}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.entry_type}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{format(time, "dd/MM/yyyy")}</p>
                                <p className="text-xs text-muted-foreground font-mono">{formatTime(entry.recorded_at)}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {entry.latitude ? (
                                <Badge variant="outline" className="text-xs">
                                  {entry.latitude.toFixed(4)}, {entry.longitude?.toFixed(4)}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Espelho de Ponto */
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Saída</TableHead>
                      <TableHead>Pausa</TableHead>
                      <TableHead>Trabalhado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dailySummaries.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro encontrado</TableCell></TableRow>
                    ) : (
                      dailySummaries.slice(0, 100).map((s, i) => {
                        const wH = Math.floor(s.workedMinutes / 60);
                        const wM = s.workedMinutes % 60;
                        return (
                          <TableRow key={i}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{s.name}</p>
                                <p className="text-xs text-muted-foreground">{EMPLOYEE_TYPE_LABELS[s.type]}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(s.date + "T12:00:00"), "dd/MM/yyyy")}
                            </TableCell>
                            <TableCell className="font-mono">{formatTime(s.clockIn)}</TableCell>
                            <TableCell className="font-mono">{formatTime(s.clockOut)}</TableCell>
                            <TableCell>{s.breakMinutes}min</TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {wH}h{wM.toString().padStart(2, "0")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
