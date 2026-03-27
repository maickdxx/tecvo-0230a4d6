import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { TrendingUp, Users, CheckCircle2, Play, Pause, Trophy, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function AdminABTests() {
  const { abTestResults } = useAdminAnalytics();
  const { toast } = useToast();

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

  if (!abTestResults.data || abTestResults.data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <h3 className="text-lg font-medium">Nenhum teste A/B encontrado</h3>
        <p className="text-muted-foreground max-w-xs">
          Os testes A/B configurados no banco de dados aparecerão aqui.
        </p>
      </div>
    );
  }

  // Group by test
  const tests = abTestResults.data.reduce((acc: any, curr: any) => {
    if (!acc[curr.test_id]) {
      acc[curr.test_id] = {
        id: curr.test_id,
        name: curr.test_name,
        variants: []
      };
    }
    acc[curr.test_id].variants.push(curr);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.values(tests).map((test: any) => {
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
                    <Badge variant="secondary">Encerrado</Badge>
                  )}
                </CardTitle>
                <CardDescription>Comparação de performance entre variantes</CardDescription>
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
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleSetWinner(test.id, variant.variant_id)}
                          disabled={!test.is_active || variant.variant_id === test.winner_variant_id}
                        >
                          Definir Vencedor
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {lift > 5 && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex gap-3 items-start">
                  <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-700">Otimização Detectada!</h4>
                    <p className="text-xs text-emerald-600">
                      A variante <strong>{winner.variant_name}</strong> está performando {lift.toFixed(1)}% melhor que a pior versão. 
                      Sugerimos aplicar esta versão como vencedora.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
