import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  MousePointer2, 
  ExternalLink,
  Timer,
  Layout,
  User,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

interface LeadJourneyDetailsProps {
  visitorId: string;
  onBack: () => void;
}

export function LeadJourneyDetails({ visitorId, onBack }: LeadJourneyDetailsProps) {
  const { fetchLeadJourneyDetail } = useAdminAnalytics();

  const { data: timeline, isLoading } = useQuery({
    queryKey: ["lead-journey-detail", visitorId],
    queryFn: () => fetchLeadJourneyDetail(visitorId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const totalTimeSeconds = timeline && timeline.length > 1
    ? (new Date(timeline[timeline.length - 1].created_at).getTime() - new Date(timeline[0].created_at).getTime()) / 1000
    : 0;

  const pageViews = timeline?.filter(e => e.event_type === 'page_view' || e.event_type === 'landing_page_view') || [];
  const interactions = timeline?.filter(e => e.event_type !== 'page_view' && e.event_type !== 'landing_page_view') || [];
  const lastPage = pageViews[pageViews.length - 1];
  const hasCta = timeline?.some(e => e.event_type === 'create_account_click');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar para a lista
        </Button>
        <div className="flex gap-2">
          <Badge variant="outline" className="font-mono">{visitorId.slice(0, 8)}...</Badge>
          {hasCta ? (
            <Badge className="bg-green-500">Clicou em CTA</Badge>
          ) : (
            <Badge variant="secondary">Sem conversão</Badge>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Tempo Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(totalTimeSeconds / 60)}m {Math.floor(totalTimeSeconds % 60)}s
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Layout className="h-4 w-4 text-primary" /> Páginas Visitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pageViews.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MousePointer2 className="h-4 w-4 text-primary" /> Interações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{interactions.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Linha do Tempo</CardTitle>
            <CardDescription>Caminho detalhado percorrido pelo lead</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted-foreground/20 before:to-transparent">
                {timeline?.map((event, idx) => {
                  const isLast = idx === timeline.length - 1;
                  const isFirst = idx === 0;
                  
                  return (
                    <div key={idx} className="relative flex items-start gap-6">
                      <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm z-10 ${
                        event.event_type === 'create_account_click' ? 'border-primary ring-2 ring-primary/20' : ''
                      }`}>
                        {event.event_type === 'page_view' || event.event_type === 'landing_page_view' ? (
                          <Layout className="h-4 w-4 text-primary" />
                        ) : event.event_type === 'create_account_click' ? (
                          <MousePointer2 className="h-4 w-4 text-primary fill-primary/10" />
                        ) : (
                          <Activity className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col gap-1 pt-1 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm">
                            {event.event_type === 'page_view' || event.event_type === 'landing_page_view' 
                              ? `Visitou ${event.page_title || event.page_path}` 
                              : event.event_type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap bg-muted px-2 py-0.5 rounded">
                            {format(new Date(event.created_at), 'HH:mm:ss', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                          {event.page_path && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" /> {event.page_path}
                            </span>
                          )}
                          {event.duration_on_page && event.duration_on_page > 0 && (
                            <span className="flex items-center gap-1">
                              <Timer className="h-3 w-3" /> {event.duration_on_page}s na página anterior
                            </span>
                          )}
                        </div>
                        {(event.metadata as any)?.utm_source && (
                          <div className="mt-2 flex gap-1">
                            <Badge variant="outline" className="text-[9px] h-4">
                              {(event.metadata as any).utm_source} / {(event.metadata as any).utm_medium}
                            </Badge>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status de Abandono</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2 border border-muted">
                <div className="text-[10px] uppercase text-muted-foreground font-semibold">Última Página</div>
                <div className="text-sm font-medium truncate">{lastPage?.page_title || lastPage?.page_path || 'N/A'}</div>
              </div>

              <div className={`p-3 rounded-lg flex items-center gap-3 border ${
                hasCta ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
              }`}>
                {hasCta ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    <div className="text-xs font-medium">Interessado (clicou em CTA)</div>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div className="text-xs font-medium">Frio (não clicou em CTA)</div>
                  </>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground italic">
                Última interação há {format(new Date(timeline?.[timeline.length - 1]?.created_at || new Date()), "HH:mm 'de' dd/MM", { locale: ptBR })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Atributos do Lead</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="text-muted-foreground">Origem:</div>
                <div className="font-medium text-right truncate">{(timeline?.[0]?.metadata as any)?.utm_source || 'Direto'}</div>
                
                <div className="text-muted-foreground">Médio:</div>
                <div className="font-medium text-right truncate">{(timeline?.[0]?.metadata as any)?.utm_medium || 'N/A'}</div>
                
                <div className="text-muted-foreground">Campanha:</div>
                <div className="font-medium text-right truncate">{(timeline?.[0]?.metadata as any)?.utm_campaign || 'N/A'}</div>

                <div className="text-muted-foreground">Dispositivo:</div>
                <div className="font-medium text-right truncate text-[9px]">{(timeline?.[0]?.metadata as any)?.user_agent?.split(' ')[0] || 'Desktop'}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" /> Análise de Gargalo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-[11px] space-y-2">
                {!hasCta && pageViews.length > 2 && (
                  <p>O lead visitou {pageViews.length} páginas mas não clicou em nenhum CTA. Considere revisar o copy da página <strong>{lastPage?.page_title || lastPage?.page_path}</strong>.</p>
                )}
                {hasCta && (
                  <p>O lead demonstrou interesse clicando em CTA, mas abandonou antes do cadastro. Verifique se o formulário de cadastro está muito complexo.</p>
                )}
                {totalTimeSeconds < 10 && (
                  <p className="text-destructive font-medium">Rejeição Imediata: O lead saiu em menos de 10 segundos. Verifique se a promessa do anúncio condiz com a landing page.</p>
                )}
                {!hasCta && pageViews.length <= 2 && totalTimeSeconds > 10 && (
                  <p>Baixo Engajamento: O lead passou {Math.round(totalTimeSeconds)}s mas explorou pouco. Considere CTAs mais visíveis na home.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Lightbulb({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .5 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
      <path d="M9 18h6" />
      <path d="M10 22h4" />
    </svg>
  );
}

function Activity({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function CheckCircle2({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
