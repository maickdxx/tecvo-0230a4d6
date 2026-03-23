import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChangelogTimeline, FeedbackForm, FeedbackList } from "@/components/updates";
import { Megaphone, MessageSquarePlus, History } from "lucide-react";
import type { ChangelogEntry, ChangeType } from "@/components/updates/ChangelogTimeline";

const changelog: ChangelogEntry[] = [
  {
    version: "v2.5",
    date: "6 de Março de 2026",
    changes: [
      { type: "novidade", description: "Dashboard executivo com bloco de Situação Atual e previsão de caixa de 15 dias" },
      { type: "novidade", description: "Bloco Motor de Receita com análise de ticket médio e taxa de conversão" },
      { type: "novidade", description: "Bloco de Eficiência Operacional com tempo médio de atendimento" },
      { type: "melhoria", description: "Radar operacional com visualização gráfica de métricas-chave" },
      { type: "melhoria", description: "Dashboard personalizável: reorganize e oculte seções como preferir" },
      { type: "correcao", description: "Indicadores de risco e previsão unificados para maior clareza" },
    ],
  },
  {
    version: "v2.4",
    date: "28 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Módulo de Recorrência para serviços periódicos (mensal, trimestral, etc.)" },
      { type: "novidade", description: "Transferências entre contas financeiras" },
      { type: "novidade", description: "Relatório de Recebimentos por Técnico com exportação em PDF" },
      { type: "melhoria", description: "Formulários de Contas a Pagar e Receber em página cheia com mais campos" },
      { type: "melhoria", description: "Previsão do tempo integrada ao Dashboard com alertas de chuva" },
      { type: "correcao", description: "Correção no cálculo de saldo ao confirmar pagamentos de serviço" },
    ],
  },
  {
    version: "v2.3",
    date: "25 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Assinatura digital do cliente via link externo (sem login)" },
      { type: "novidade", description: "Redefinição de senha com código OTP por e-mail" },
      
      { type: "melhoria", description: "PDF de Ordem de Serviço com assinatura do cliente integrada" },
      { type: "melhoria", description: "Fotos de antes/depois vinculadas à OS" },
      { type: "correcao", description: "Correção na exibição de endereço do serviço no PDF" },
    ],
  },
  {
    version: "v2.2",
    date: "22 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Ranking semanal de técnicos na tela Meu Dia" },
      { type: "novidade", description: "Despesas de funcionário com fluxo de aprovação" },
      { type: "novidade", description: "Alertas inteligentes no Dashboard" },
      { type: "melhoria", description: "Capacidade operacional configurável (horários, equipes, sábado)" },
      { type: "melhoria", description: "Permissões granulares por módulo para membros da equipe" },
      { type: "correcao", description: "Correção no filtro de período global do Dashboard" },
    ],
  },
  {
    version: "v2.1",
    date: "20 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Conta financeira padrão vinculada a cada forma de pagamento" },
      { type: "novidade", description: "Notificações push via PWA (Service Worker)" },
      { type: "novidade", description: "Modo demonstração com dados fictícios para novos usuários" },
      { type: "melhoria", description: "Onboarding guiado simplificado" },
      { type: "melhoria", description: "Seletor de tipo de pessoa (PF/PJ) no cadastro de clientes" },
      { type: "correcao", description: "Correção no envio duplicado de convites para a mesma equipe" },
    ],
  },
  {
    version: "v2.0",
    date: "18 de Fevereiro de 2026",
    changes: [
      { type: "melhoria", description: "PDF da Ordem de Serviço com visual premium e corporativo" },
      { type: "melhoria", description: "Título da OS com maior destaque visual (fonte 14pt + linha decorativa)" },
      { type: "melhoria", description: "Bloco de valor total com maior contraste e borda destacada" },
      { type: "melhoria", description: "Linhas de assinatura pontilhadas para visual mais elegante" },
      { type: "novidade", description: "Mensagem de confiança adicionada acima das assinaturas na OS" },
      { type: "melhoria", description: "Rodapé profissional atualizado no PDF da OS" },
      { type: "correcao", description: "Posição da assinatura corrigida para não sobrepor dados de pagamento" },
    ],
  },
  {
    version: "v1.9",
    date: "14 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Email de verificação profissional com branding Tecvo" },
      { type: "novidade", description: "Confirmação por código OTP de 6 dígitos no cadastro" },
      { type: "novidade", description: "Tela de autenticação redesenhada com layout premium em duas colunas" },
      { type: "melhoria", description: "Suporte a re-cadastro de emails de contas excluídas" },
      { type: "melhoria", description: "Botão de reenvio de código com cooldown de 60 segundos" },
      { type: "correcao", description: "Correção no envio de emails para contas previamente deletadas" },
    ],
  },
  {
    version: "v1.8",
    date: "11 de Fevereiro de 2026",
    changes: [
      { type: "correcao", description: "Funcionário agora consegue concluir serviços atribuídos a ele" },
      { type: "melhoria", description: "Campos de horário de entrada e saída melhorados no formulário de OS" },
      { type: "melhoria", description: "Menu lateral não fecha mais ao navegar entre páginas" },
    ],
  },
  {
    version: "v1.7",
    date: "10 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Chat ao vivo integrado na página de Suporte" },
      { type: "novidade", description: "Página de Tutorial com guia passo a passo" },
      { type: "melhoria", description: "Sidebar com grupos colapsáveis para melhor organização" },
    ],
  },
  {
    version: "v1.6",
    date: "8 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Sistema de convites para membros da equipe" },
      { type: "novidade", description: "Catálogo de serviços com preços padrão" },
      { type: "correcao", description: "Correção no cálculo de descontos em itens de serviço" },
    ],
  },
  {
    version: "v1.5",
    date: "5 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Módulo Financeiro com contas a pagar e receber" },
      { type: "novidade", description: "Relatórios financeiros com gráficos" },
      { type: "melhoria", description: "Dashboard com resumo de faturamento mensal" },
    ],
  },
  {
    version: "v1.4",
    date: "1 de Fevereiro de 2026",
    changes: [
      { type: "novidade", description: "Lixeira com recuperação de registros excluídos" },
      { type: "melhoria", description: "Formulário de clientes com busca por CEP automática" },
      { type: "correcao", description: "Correção na geração de PDF de orçamentos" },
    ],
  },
];

type FilterType = "todos" | ChangeType;

export default function Atualizacoes() {
  const [filter, setFilter] = useState<FilterType>("todos");

  const filteredEntries = useMemo(() => {
    if (filter === "todos") return changelog;
    return changelog
      .map((entry) => ({
        ...entry,
        changes: entry.changes.filter((c) => c.type === filter),
      }))
      .filter((entry) => entry.changes.length > 0);
  }, [filter]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Megaphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Atualizações</h1>
            <p className="text-sm text-muted-foreground">Novidades, correções e melhorias do sistema</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Changelog */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Histórico de Atualizações</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)} className="space-y-4">
                  <TabsList className="w-full justify-start">
                    <TabsTrigger value="todos">Todos</TabsTrigger>
                    <TabsTrigger value="novidade">Novidades</TabsTrigger>
                    <TabsTrigger value="correcao">Correções</TabsTrigger>
                    <TabsTrigger value="melhoria">Melhorias</TabsTrigger>
                  </TabsList>
                  <TabsContent value={filter}>
                    <ChangelogTimeline entries={filteredEntries} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Feedback sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Enviar Feedback</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <FeedbackForm />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seus Feedbacks</CardTitle>
              </CardHeader>
              <CardContent>
                <FeedbackList />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
