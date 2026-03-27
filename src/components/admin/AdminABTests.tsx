import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { 
  TrendingUp, 
  Users, 
  CheckCircle2, 
  Play, 
  Pause, 
  Trophy, 
  AlertTriangle, 
  Lightbulb, 
  Plus, 
  History, 
  ArrowRight,
  Target,
  FileText,
  MousePointer2,
  Star,
  Layout
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AdminABTests() {
  const { abTestResults, hypotheses, marketingFunnel, leadDropoffs } = useAdminAnalytics();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newHypothesis, setNewHypothesis] = useState({
    problem_identified: "",
    hypothesis_improvement: "",
    proposed_solution: "",
    expected_impact: "medium"
  });

  const handleToggleTest = async (testId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("ab_tests")
        .update({ is_active: !currentStatus })
        .eq("id", testId);

      if (error) throw error;

      toast({
        title: `Teste ${!currentStatus ? 'ativado' : 'desativado'}`,
        description: "O status do teste foi atualizado com sucesso.",
      });
      
      abTestResults.refetch();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar teste",
        description: "Não foi possível alterar o status do teste.",
      });
    }
  };

  const handleSetWinner = async (testId: string, variantId: string) => {
    try {
      const { error } = await supabase
        .from("ab_tests")
        .update({ 
          winner_variant_id: variantId,
          is_active: false,
          end_date: new Date().toISOString()
        })
        .eq("id", testId);

      if (error) throw error;

      toast({
        title: "Vencedor definido!",
        description: "O teste foi encerrado e a variante vencedora foi registrada.",
      });
      
      abTestResults.refetch();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao definir vencedor",
        description: "Não foi possível registrar a variante vencedora.",
      });
    }
  };

  const handleSavePattern = async (testName: string, variantName: string, conversionRate: number, testId: string) => {
    try {
      const { error } = await supabase
        .from("ab_test_winning_patterns")
        .insert([{
          name: `${testName} - ${variantName}`,
          pattern_type: 'headline',
          content: { variant_name: variantName },
          performance_lift: 0,
          conversion_rate: conversionRate,
          source_test_id: testId,
          description: `Padrão vencedor identificado no teste ${testName}`
        }]);

      if (error) throw error;

      toast({
        title: "Padrão salvo!",
        description: "Este aprendizado agora é um ativo reutilizável.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar padrão",
        description: "Não foi possível registrar o padrão vencedor.",
      });
    }
  };

  const handleCreateHypothesis = async () => {
    try {
      const { error } = await supabase
        .from("ab_test_hypotheses")
        .insert([newHypothesis]);

      if (error) throw error;

      toast({
        title: "Hipótese registrada",
        description: "A nova hipótese foi salva com sucesso.",
      });
      
      hypotheses.refetch();
      setIsDialogOpen(false);
      setNewHypothesis({
        problem_identified: "",
        hypothesis_improvement: "",
        proposed_solution: "",
        expected_impact: "medium"
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erro ao criar hipótese",
        description: "Não foi possível registrar a hipótese.",
      });
    }
  };

  const getSuggestions = () => {
    const suggestions = [];
    if (marketingFunnel.data) {
      if ((marketingFunnel.data.cta_click_rate || 0) < 5) {
        suggestions.push({
          type: "cta",
          problem: "Baixa taxa de clique no CTA principal",
          hypothesis: "O CTA atual não gera senso de urgência ou não está visualmente destacado.",
          solution: "Testar nova cor contrastante ou texto mais persuasivo (ex: 'Teste Grátis Agora').",
          impact: "high"
        });
      }
      if ((marketingFunnel.data.final_conversion_rate || 0) < 1) {
        suggestions.push({
          type: "conversion",
          problem: "Baixa conversão final (venda)",
          hypothesis: "O processo de checkout pode ter fricção ou falta de prova social.",
          solution: "Adicionar selos de segurança e depoimentos próximos ao botão de pagar.",
          impact: "high"
        });
      }
    }
    if (leadDropoffs.data && leadDropoffs.data.length > 0) {
      const topDropoff = leadDropoffs.data[0];
      if (topDropoff.dropoff_count > 50) {
        suggestions.push({
          type: "dropoff",
          problem: `Alto abandono na página ${topDropoff.last_page}`,
          hypothesis: "O conteúdo desta página não está retendo o interesse ou falta clareza no próximo passo.",
          solution: `Simplificar o conteúdo da página ${topDropoff.last_page} e reduzir distrações.`,
          impact: "medium"
        });
      }
    }
    return suggestions;
  };

  const suggestions = getSuggestions();
  const activeTestsData = abTestResults.data?.filter((v: any) => !v.winner_variant_id) || [];
  const historicalTestsData = abTestResults.data?.filter((v: any) => v.winner_variant_id) || [];

  const groupTests = (data: any[]) => data.reduce((acc: any, curr: any) => {
    if (!acc[curr.test_id]) {
      acc[curr.test_id] = {
        id: curr.test_id,
        name: curr.test_name,
        is_active: curr.is_active,
        winner_variant_id: curr.winner_variant_id,
        variants: []
      };
    }
    acc[curr.test_id].variants.push(curr);
    return acc;
  }, {});

  const activeTests = groupTests(activeTestsData);
  const historicalTests = groupTests(historicalTestsData);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 bg-muted/50">
          <TabsTrigger value="active" className="gap-2 whitespace-nowrap">
            <Target className="h-4 w-4" />
            Testes Ativos
          </TabsTrigger>
          <TabsTrigger value="hypotheses" className="gap-2 whitespace-nowrap">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Hipóteses & Estratégia
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2 whitespace-nowrap">
            <History className="h-4 w-4" />
            Biblioteca (Histórico)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-6 pt-4">
          {Object.values(activeTests).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/20">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-medium">Nenhum teste ativo no momento</h3>
              <p className="text-muted-foreground max-w-xs mb-6">
                Crie um novo teste a partir de uma hipótese estratégica.
              </p>
              <Button onClick={() => document.getElementById('trigger-hypotheses-tab')?.click()}>
                Ir para Hipóteses
              </Button>
            </div>
          ) : (
            Object.values(activeTests).map((test: any) => {
              const sortedVariants = [...test.variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
              const winner = sortedVariants[0];
              const loser = sortedVariants[sortedVariants.length - 1];
              const lift = loser.conversion_rate > 0 
                ? ((winner.conversion_rate - loser.conversion_rate) / loser.conversion_rate) * 100 
                : 0;

              return (
                <Card key={test.id}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {test.name}
                        {test.is_active ? (
                          <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Pausado</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>Comparação de performance em tempo real</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleToggleTest(test.id, test.is_active)}
                        className="gap-2"
                      >
                        {test.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        {test.is_active ? 'Pausar' : 'Ativar'}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <Users className="h-4 w-4" />
                          Total de Usuários
                        </div>
                        <div className="text-2xl font-bold">
                          {test.variants.reduce((acc: number, v: any) => acc + Number(v.total_users), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Total de Conversões
                        </div>
                        <div className="text-2xl font-bold">
                          {test.variants.reduce((acc: number, v: any) => acc + Number(v.total_conversions), 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-card p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <TrendingUp className="h-4 w-4 text-emerald-500" />
                          Melhoria (Lift)
                        </div>
                        <div className="text-2xl font-bold text-emerald-500">
                          +{lift.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Variante</TableHead>
                          <TableHead className="text-right">Usuários</TableHead>
                          <TableHead className="text-right">Conversões</TableHead>
                          <TableHead className="text-right">Taxa de Conversão</TableHead>
                          <TableHead className="text-right">Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {test.variants.map((variant: any) => (
                          <TableRow key={variant.variant_id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                {variant.variant_name}
                                {variant.variant_id === winner.variant_id && (
                                  <Trophy className="h-3 w-3 text-amber-500" />
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{variant.total_users.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{variant.total_conversions.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-bold">
                              {variant.conversion_rate}%
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => handleSetWinner(test.id, variant.variant_id)}
                                  disabled={!test.is_active}
                                >
                                  Definir Vencedor
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-8 gap-1"
                                  onClick={() => handleSavePattern(test.name, variant.variant_name, variant.conversion_rate, test.id)}
                                >
                                  <Star className="h-3 w-3" /> Salvar Padrão
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="hypotheses" className="space-y-6 pt-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Gestão de Hipóteses
            </h3>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Hipótese
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Hipótese</DialogTitle>
                  <DialogDescription>
                    Baseie sua hipótese em problemas reais identificados no funil.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Problema Identificado</label>
                    <Input 
                      placeholder="Ex: Baixa conversão na página de preços" 
                      value={newHypothesis.problem_identified}
                      onChange={(e) => setNewHypothesis({...newHypothesis, problem_identified: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hipótese de Melhoria</label>
                    <Textarea 
                      placeholder="Ex: Acreditamos que os planos não estão claros..."
                      value={newHypothesis.hypothesis_improvement}
                      onChange={(e) => setNewHypothesis({...newHypothesis, hypothesis_improvement: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Solução Proposta</label>
                    <Input 
                      placeholder="Ex: Novo design da tabela de preços"
                      value={newHypothesis.proposed_solution}
                      onChange={(e) => setNewHypothesis({...newHypothesis, proposed_solution: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Impacto Esperado</label>
                    <Select 
                      value={newHypothesis.expected_impact}
                      onValueChange={(val) => setNewHypothesis({...newHypothesis, expected_impact: val})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o impacto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixo</SelectItem>
                        <SelectItem value="medium">Médio</SelectItem>
                        <SelectItem value="high">Alto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreateHypothesis}>Salvar Hipótese</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s, idx) => (
              <Card key={idx} className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-100">Sugestão de IA</Badge>
                    <span className="text-[10px] font-bold uppercase text-amber-600">Impacto {s.impact}</span>
                  </div>
                  <CardTitle className="text-base mt-2">{s.problem}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground italic">"{s.hypothesis}"</p>
                  <div className="bg-white p-3 rounded-md border border-amber-100 text-xs text-amber-900">
                    <strong>Solução:</strong> {s.solution}
                  </div>
                  <Button 
                    className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white" 
                    size="sm"
                    onClick={() => {
                      setNewHypothesis({
                        problem_identified: s.problem,
                        hypothesis_improvement: s.hypothesis,
                        proposed_solution: s.solution,
                        expected_impact: s.impact
                      });
                      setIsDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Criar Hipótese
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Hipóteses</CardTitle>
              <CardDescription>Acompanhe o que já foi pensado e testado</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Problema</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Impacto</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hypotheses.data?.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="text-sm">{h.problem_identified}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{h.proposed_solution}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={h.status === 'completed' ? 'default' : 'secondary'} className="capitalize">
                          {h.status === 'active' ? 'Em Teste' : h.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {h.expected_impact}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(h.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="gap-1">
                          Ver Detalhes
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!hypotheses.data?.length && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhuma hipótese registrada ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-6 pt-4">
          <div className="grid gap-6">
            {Object.values(historicalTests).map((test: any) => {
              const sortedVariants = [...test.variants].sort((a, b) => b.conversion_rate - a.conversion_rate);
              const winner = sortedVariants.find(v => v.variant_id === test.winner_variant_id) || sortedVariants[0];
              const loser = sortedVariants[sortedVariants.length - 1];
              const lift = loser.conversion_rate > 0 
                ? ((winner.conversion_rate - loser.conversion_rate) / loser.conversion_rate) * 100 
                : 0;

              return (
                <Card key={test.id} className="overflow-hidden border-l-4 border-l-emerald-500">
                  <div className="bg-emerald-50/50 p-4 border-b flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <History className="h-5 w-5 text-emerald-600" />
                      <div>
                        <h4 className="font-bold text-emerald-900">{test.name}</h4>
                        <p className="text-xs text-emerald-700">Encerrado em {new Date().toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">Vencedor Aplicado</Badge>
                  </div>
                  <CardContent className="pt-6 grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        <span className="font-semibold">Resultado Final:</span>
                        <span className="text-emerald-600 font-bold">+{lift.toFixed(1)}% de Lift</span>
                      </div>
                      <div className="bg-white p-4 rounded-lg border">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium mb-1">Variante Vencedora:</p>
                            <p className="text-lg font-bold text-emerald-700">{winner.variant_name}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Taxa de Conversão: <strong>{winner.conversion_rate}%</strong>
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2 border-emerald-500/20 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleSavePattern(test.name, winner.variant_name, winner.conversion_rate, test.id)}
                          >
                            <Trophy className="h-4 w-4" />
                            Salvar como Padrão
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h5 className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Aprendizado Gerado
                      </h5>
                      <p className="text-sm text-muted-foreground bg-muted/30 p-4 rounded-lg">
                        A simplificação do texto e a mudança da cor para uma paleta mais urgente resultou em um aumento significativo nos cliques iniciais, sugerindo que nossos usuários respondem melhor a comunicações diretas e de alto contraste.
                      </p>
                      <Button variant="outline" className="w-full gap-2">
                        Reutilizar Variação Vencedora
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            
            {Object.values(historicalTests).length === 0 && (
              <div className="text-center py-12 border rounded-lg bg-muted/10 text-muted-foreground">
                Ainda não há testes no histórico.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
      
      <button id="trigger-hypotheses-tab" className="hidden" onClick={() => {
        const tabList = document.querySelector('[role="tablist"]');
        const hypothesesTab = tabList?.querySelector('[value="hypotheses"]') as HTMLElement;
        hypothesesTab?.click();
      }} />
    </div>
  );
}
