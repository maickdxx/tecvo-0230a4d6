import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Users, 
  Search, 
  Filter, 
  ChevronRight,
  MousePointer2,
  Calendar,
  Globe,
  ArrowRight,
  Activity
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { LeadJourneyDetails } from "./LeadJourneyDetails";

export function LeadJourneyTab() {
  const { leadJourneys } = useAdminAnalytics();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);

  if (selectedVisitorId) {
    return <LeadJourneyDetails visitorId={selectedVisitorId} onBack={() => setSelectedVisitorId(null)} />;
  }

  const filteredLeads = leadJourneys.data?.filter(lead => 
    lead.visitor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (lead.source && lead.source.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Jornada do Lead</h2>
          <p className="text-muted-foreground">Analise o comportamento individual de cada visitante antes da conversão.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por ID ou origem..."
              className="pl-8 w-full md:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leadJourneys.data?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Visitantes não convertidos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Interesse</CardTitle>
            <MousePointer2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadJourneys.data?.filter(l => l.clicked_cta).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Clicaram em pelo menos um CTA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadJourneys.data && leadJourneys.data.length > 0 
                ? Math.round(leadJourneys.data.reduce((acc, l) => acc + (l.total_duration_seconds || 0), 0) / leadJourneys.data.length / 60) 
                : 0} min
            </div>
            <p className="text-xs text-muted-foreground">Média de permanência no site</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Páginas/Lead</CardTitle>
            <Globe className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadJourneys.data && leadJourneys.data.length > 0 
                ? (leadJourneys.data.reduce((acc, l) => acc + (l.unique_pages || 0), 0) / leadJourneys.data.length).toFixed(1) 
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">Média de profundidade</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Leads Recentes</CardTitle>
          <CardDescription>Lista de visitantes ativos no site que ainda não concluíram cadastro.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visitante</TableHead>
                <TableHead>Última Atividade</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Páginas</TableHead>
                <TableHead>Interesse</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.visitor_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedVisitorId(lead.visitor_id)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs">{lead.visitor_id.slice(0, 12)}...</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{lead.last_page}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs">{format(new Date(lead.last_seen), "HH:mm 'de' dd/MM", { locale: ptBR })}</span>
                      <span className="text-[10px] text-muted-foreground">Duração: {Math.round((lead.total_duration_seconds || 0) / 60)} min</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {lead.source || 'Direto'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <Globe className="h-3 w-3 text-muted-foreground" />
                      {lead.unique_pages}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.clicked_cta ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px]">
                        Interessado
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Visitante
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-2">
                      Ver Jornada <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum lead encontrado para os critérios selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
