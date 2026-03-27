import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Star, MousePointer2, Layout, Copy, Check, Filter, Search, Tag, ShieldCheck, ShieldAlert, Zap, Globe } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WinningPattern {
  id: string;
  name: string;
  pattern_type: string;
  category: string;
  description: string;
  content: any;
  performance_lift: number;
  is_validated: boolean;
  tags: string[];
}

interface PatternApplications {
  id: string;
  pattern_id: string;
  target_page: string;
  target_element: string;
  applied_at: string;
  is_active: boolean;
  ab_test_winning_patterns?: {
    name: string;
    pattern_type: string;
  };
}

interface AdminPatternsProps {
  patterns: WinningPattern[];
  applications: PatternApplications[];
  onRefetch: () => void;
}

export function AdminPatterns({ patterns, applications, onRefetch }: AdminPatternsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { toast } = useToast();

  const filteredPatterns = patterns?.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category === categoryFilter || p.pattern_type === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleValidate = async (id: string, isValidated: boolean) => {
    try {
      const { error } = await supabase
        .from("ab_test_winning_patterns")
        .update({ is_validated: isValidated })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: isValidated ? "Padrão Validado" : "Validação Removida",
        description: "O status de governança do padrão foi atualizado.",
      });
      onRefetch();
    } catch (err) {
      toast({
        title: "Erro ao validar",
        description: "Não foi possível atualizar o status do padrão.",
        variant: "destructive",
      });
    }
  };

  const handleApplyToNew = async (patternId: string) => {
    toast({
      title: "Aplicação Automática",
      description: "Este padrão será aplicado automaticamente em novos projetos do mesmo nicho.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar padrões..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="headline">Headlines</SelectItem>
              <SelectItem value="cta">CTAs</SelectItem>
              <SelectItem value="structure">Estruturas</SelectItem>
              <SelectItem value="social_proof">Prova Social</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredPatterns?.map((pattern) => (
          <Card key={pattern.id} className={`border-border ${pattern.is_validated ? 'bg-primary/5' : 'bg-muted/30'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-primary border-primary/20 bg-primary/10">Padrão Vencedor</Badge>
                  {pattern.is_validated && (
                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground border-secondary">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Validado
                    </Badge>
                  )}
                </div>
                <span className="text-[10px] font-bold uppercase text-primary">Lift +{pattern.performance_lift}%</span>
              </div>
              <CardTitle className="text-base mt-2 flex items-center gap-2">
                {pattern.pattern_type === 'headline' && <Star className="h-4 w-4 text-amber-500" />}
                {pattern.pattern_type === 'cta' && <MousePointer2 className="h-4 w-4 text-blue-500" />}
                {pattern.pattern_type === 'structure' && <Layout className="h-4 w-4 text-primary" />}
                {pattern.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{pattern.description}</p>
              
              <div className="p-3 bg-white rounded border text-xs font-mono max-h-32 overflow-y-auto">
                <pre>{typeof pattern.content === 'string' ? pattern.content : JSON.stringify(pattern.content, null, 2)}</pre>
              </div>

              <div className="flex flex-wrap gap-1">
                {pattern.tags?.map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-[10px] py-0 h-5">
                    <Tag className="h-2 w-2 mr-1" /> {tag}
                  </Badge>
                ))}
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Escalabilidade: Consistente</span>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1">
                    <Copy className="h-3 w-3" /> Copiar
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant={pattern.is_validated ? "outline" : "default"} 
                    size="sm" 
                    className="flex-1 text-xs h-8"
                    onClick={() => handleValidate(pattern.id, !pattern.is_validated)}
                  >
                    {pattern.is_validated ? (
                      <><ShieldAlert className="h-3 w-3 mr-1" /> Invalidar</>
                    ) : (
                      <><ShieldCheck className="h-3 w-3 mr-1" /> Validar</>
                    )}
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="flex-1 text-xs h-8"
                    onClick={() => handleApplyToNew(pattern.id)}
                  >
                    <Zap className="h-3 w-3 mr-1" /> Aplicar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!filteredPatterns || filteredPatterns.length === 0) && (
          <div className="col-span-full py-12 text-center border-2 border-dashed rounded-lg bg-muted/10">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-muted-foreground">Nenhum padrão encontrado</h3>
            <p className="text-sm text-muted-foreground mb-4">Tente ajustar seus filtros ou busca.</p>
          </div>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Governança: Aplicações Automáticas em Tempo Real
              </CardTitle>
              <CardDescription>Acompanhe onde os padrões validados estão sendo aplicados e seu impacto atual.</CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Escala Ativa
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative overflow-x-auto rounded-lg border">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3">Padrão Aplicado</th>
                  <th className="px-4 py-3">Página / Destino</th>
                  <th className="px-4 py-3">Elemento</th>
                  <th className="px-4 py-3">Data Aplicação</th>
                  <th className="px-4 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {applications?.map((app) => (
                  <tr key={app.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        {app.ab_test_winning_patterns?.pattern_type === 'headline' && <Star className="h-3 w-3 text-primary" />}
                        {app.ab_test_winning_patterns?.pattern_type === 'cta' && <MousePointer2 className="h-3 w-3 text-primary" />}
                        {app.ab_test_winning_patterns?.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-muted-foreground" />
                        {app.target_page}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{app.target_element}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(app.applied_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={app.is_active ? "default" : "secondary"} className="text-[10px]">
                        {app.is_active ? "Ativo" : "Pausado"}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(!applications || applications.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">
                      Nenhuma aplicação automática registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
