import { lazy, Suspense, ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import { ViewModeProvider } from "@/contexts/ViewModeContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AudioProvider } from "@/contexts/AudioContext";
import { DemoTourProvider } from "@/hooks/useDemoTour";
import { SessionTrackerProvider } from "@/components/SessionTrackerProvider";
import { AdminProtectedRoute } from "@/components/admin";
import { CookieConsent } from "./components/CookieConsent";

// ============================
// Eagerly loaded (landing + auth — first paint)
// ============================
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// ============================
// Lazy-loaded pages (code-split chunks)
// ============================
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Servicos = lazy(() => import("./pages/Servicos"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Fornecedores = lazy(() => import("./pages/Fornecedores"));
const Orcamentos = lazy(() => import("./pages/Orcamentos"));
const OrdensServico = lazy(() => import("./pages/OrdensServico"));
const NovaOrdemServico = lazy(() => import("./pages/NovaOrdemServico"));
const EditarOrdemServico = lazy(() => import("./pages/EditarOrdemServico"));
const OrdemServicoDetalhes = lazy(() => import("./pages/OrdemServicoDetalhes"));
const NovoOrcamento = lazy(() => import("./pages/NovoOrcamento"));
const EditarOrcamento = lazy(() => import("./pages/EditarOrcamento"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Agenda = lazy(() => import("./pages/Agenda"));
const MeusServicos = lazy(() => import("./pages/MeusServicos"));
const CatalogoServicos = lazy(() => import("./pages/CatalogoServicos"));
const Instalar = lazy(() => import("./pages/Instalar"));
const ContasPagar = lazy(() => import("./pages/ContasPagar"));
const ContasReceber = lazy(() => import("./pages/ContasReceber"));
const RelatoriosFinanceiros = lazy(() => import("./pages/RelatoriosFinanceiros"));
const FormasPagamento = lazy(() => import("./pages/FormasPagamento"));
const CategoriasFinanceiras = lazy(() => import("./pages/CategoriasFinanceiras"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Admin = lazy(() => import("./pages/Admin"));
const Suporte = lazy(() => import("./pages/Suporte"));
const Tutorial = lazy(() => import("./pages/Tutorial"));
const Lixeira = lazy(() => import("./pages/Lixeira"));
const Atualizacoes = lazy(() => import("./pages/Atualizacoes"));
const Pricing = lazy(() => import("./pages/Pricing"));
const IAClientesInativos = lazy(() => import("./pages/IAClientesInativos"));
const IAPagamentosVencidos = lazy(() => import("./pages/IAPagamentosVencidos"));
const IAAgendaProximos = lazy(() => import("./pages/IAAgendaProximos"));
const IAReceitaPrevista = lazy(() => import("./pages/IAReceitaPrevista"));
const EmployeeDashboard = lazy(() => import("./pages/EmployeeDashboard"));
const EmployeeHistory = lazy(() => import("./pages/EmployeeHistory"));
const EmployeeDesempenho = lazy(() => import("./pages/EmployeeDesempenho"));
const MeuDia = lazy(() => import("./pages/MeuDia"));
const NovoCliente = lazy(() => import("./pages/NovoCliente"));
const EditarCliente = lazy(() => import("./pages/EditarCliente"));
const AssinaturaSucesso = lazy(() => import("./pages/AssinaturaSucesso"));
const AssinaturaParabens = lazy(() => import("./pages/AssinaturaParabens"));
const Transferencias = lazy(() => import("./pages/Transferencias"));
const Recorrencia = lazy(() => import("./pages/Recorrencia"));
const RecebimentosTecnico = lazy(() => import("./pages/RecebimentosTecnico"));
const NovaContaPagar = lazy(() => import("./pages/NovaContaPagar"));
const NovaContaReceber = lazy(() => import("./pages/NovaContaReceber"));
const EditarContaPagar = lazy(() => import("./pages/EditarContaPagar"));
const EditarContaReceber = lazy(() => import("./pages/EditarContaReceber"));
const AssinarOS = lazy(() => import("./pages/AssinarOS"));
const RedefinirSenha = lazy(() => import("./pages/RedefinirSenha"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const WhatsAppFull = lazy(() => import("./pages/WhatsAppFull"));
const WhatsAppBots = lazy(() => import("./pages/WhatsAppBots"));
const WhatsAppBotEdit = lazy(() => import("./pages/WhatsAppBotEdit"));
const WhatsAppEtiquetas = lazy(() => import("./pages/WhatsAppEtiquetas"));
const WhatsAppRespostasRapidas = lazy(() => import("./pages/WhatsAppRespostasRapidas"));
const WhatsAppAtendentes = lazy(() => import("./pages/WhatsAppAtendentes"));
const CanaisAtendimento = lazy(() => import("./pages/CanaisAtendimento"));
const WebchatConfig = lazy(() => import("./pages/WebchatConfig"));
const WhatsAppRelatorio = lazy(() => import("./pages/WhatsAppRelatorio"));
const WhatsAppConfiguracoes = lazy(() => import("./pages/WhatsAppConfiguracoes"));
const WhatsAppContatos = lazy(() => import("./pages/WhatsAppContatos"));
const WhatsAppMonitor = lazy(() => import("./pages/WhatsAppMonitor"));
const AgendaFull = lazy(() => import("./pages/AgendaFull"));
const Ponto = lazy(() => import("./pages/Ponto"));
const PontoAdmin = lazy(() => import("./pages/PontoAdmin"));
const HistoricoPonto = lazy(() => import("./pages/HistoricoPonto"));
const EspelhoPonto = lazy(() => import("./pages/EspelhoPonto"));
const Comunicados = lazy(() => import("./pages/Comunicados"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const LGPD = lazy(() => import("./pages/LGPD"));
const PoliticaDeCookies = lazy(() => import("./pages/PoliticaDeCookies"));
const LaudosTecnicos = lazy(() => import("./pages/LaudosTecnicos"));
const NovoLaudo = lazy(() => import("./pages/NovoLaudo"));
const EditarLaudo = lazy(() => import("./pages/EditarLaudo"));
const LaudoDetalhes = lazy(() => import("./pages/LaudoDetalhes"));
const SecretariaIA = lazy(() => import("./pages/SecretariaIA"));
const ExecutarServico = lazy(() => import("./pages/ExecutarServico"));

// Portal do Cliente
const PortalLogin = lazy(() => import("./pages/portal/PortalLogin"));
const PortalDashboard = lazy(() => import("./pages/portal/PortalDashboard"));
const PortalServiceDetails = lazy(() => import("./pages/portal/PortalServiceDetails"));
const PortalSlugResolver = lazy(() => import("./pages/portal/PortalSlugResolver"));

// Ponto sub-pages
const PontoDashboard = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoDashboard })));
const PontoRegistros = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoRegistros })));
const PontoEspelho = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoEspelho })));
const PontoFuncionarios = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoFuncionarios })));
const PontoAjustes = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoAjustes })));
const PontoRelatorios = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoRelatorios })));
const PontoConfiguracoes = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoConfiguracoes })));
const PontoCalendario = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoCalendario })));
const PontoEscalas = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoEscalas })));
const PontoFechamento = lazy(() => import("./pages/ponto").then(m => ({ default: m.PontoFechamento })));

// ============================
// Loading fallback
// ============================
function PageLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

// Wrapper for client portal routes (provides ClientPortalContext)
import { ClientPortalProvider } from "@/contexts/ClientPortalContext";
function ClientPortalWrapper({ children }: { children: ReactNode }) {
  return <ClientPortalProvider>{children}</ClientPortalProvider>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s default — prevents excessive refetches
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <SessionTrackerProvider>
            <DemoTourProvider>
            <ViewModeProvider>
            <OfflineProvider>
            <Suspense fallback={<PageLoader />}>
              <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/cadastro" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route
              path="/planos"
              element={
                <ProtectedRoute>
                  <Pricing />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro"
              element={
                <ProtectedRoute>
                  <Financeiro />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-pagar"
              element={
                <ProtectedRoute>
                  <ContasPagar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-pagar/nova"
              element={
                <ProtectedRoute>
                  <NovaContaPagar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-pagar/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarContaPagar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-receber"
              element={
                <ProtectedRoute>
                  <ContasReceber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-receber/nova"
              element={
                <ProtectedRoute>
                  <NovaContaReceber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contas-receber/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarContaReceber />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/relatorios"
              element={
                <ProtectedRoute>
                  <RelatoriosFinanceiros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/formas-pagamento"
              element={
                <ProtectedRoute>
                  <FormasPagamento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/categorias"
              element={
                <ProtectedRoute>
                  <CategoriasFinanceiras />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/transferencias"
              element={
                <ProtectedRoute>
                  <Transferencias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/financeiro/recebimentos-tecnico"
              element={
                <ProtectedRoute>
                  <RecebimentosTecnico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/servicos"
              element={
                <ProtectedRoute>
                  <Servicos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda"
              element={
                <ProtectedRoute>
                  <Agenda />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes"
              element={
                <ProtectedRoute>
                  <Clientes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes/novo"
              element={
                <ProtectedRoute>
                  <NovoCliente />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clientes/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarCliente />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fornecedores"
              element={
                <ProtectedRoute>
                  <Fornecedores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orcamentos"
              element={
                <ProtectedRoute>
                  <Orcamentos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orcamentos/novo"
              element={
                <ProtectedRoute>
                  <NovoOrcamento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orcamentos/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarOrcamento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens-servico"
              element={
                <ProtectedRoute>
                  <OrdensServico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens-servico/nova"
              element={
                <ProtectedRoute>
                  <NovaOrdemServico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens-servico/:id"
              element={
                <ProtectedRoute>
                  <OrdemServicoDetalhes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ordens-servico/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarOrdemServico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/executar-servico/:id"
              element={
                <ProtectedRoute>
                  <ExecutarServico />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meus-servicos"
              element={
                <ProtectedRoute>
                  <MeusServicos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/catalogo-servicos"
              element={
                <ProtectedRoute>
                  <CatalogoServicos />
                </ProtectedRoute>
              }
            />
            <Route path="/instalar" element={<Instalar />} />
            <Route
              path="/suporte"
              element={
                <ProtectedRoute>
                  <Suporte />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tutorial"
              element={
                <ProtectedRoute allowEmployee>
                  <Tutorial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/lixeira"
              element={
                <ProtectedRoute>
                  <Lixeira />
                </ProtectedRoute>
              }
            />
            <Route
              path="/atualizacoes"
              element={
                <ProtectedRoute allowEmployee>
                  <Atualizacoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminProtectedRoute>
                  <Admin />
                </AdminProtectedRoute>
              }
            />
            <Route
              path="/ia/clientes-inativos"
              element={
                <ProtectedRoute>
                  <IAClientesInativos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia/pagamentos-vencidos"
              element={
                <ProtectedRoute>
                  <IAPagamentosVencidos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia/agenda-proximos"
              element={
                <ProtectedRoute>
                  <IAAgendaProximos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ia/receita-prevista"
              element={
                <ProtectedRoute>
                  <IAReceitaPrevista />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee-dashboard"
              element={
                <ProtectedRoute>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee-historico"
              element={
                <ProtectedRoute>
                  <EmployeeHistory />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee-desempenho"
              element={
                <ProtectedRoute>
                  <EmployeeDesempenho />
                </ProtectedRoute>
              }
            />
            <Route
              path="/meu-dia"
              element={
                <ProtectedRoute allowEmployee>
                  <MeuDia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assinatura/sucesso"
              element={
                <ProtectedRoute>
                  <AssinaturaSucesso />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assinatura/parabens"
              element={
                <ProtectedRoute>
                  <AssinaturaParabens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/recorrencia"
              element={
                <ProtectedRoute>
                  <Recorrencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp"
              element={
                <ProtectedRoute>
                  <WhatsApp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/etiquetas"
              element={
                <ProtectedRoute>
                  <WhatsAppEtiquetas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/respostas-rapidas"
              element={
                <ProtectedRoute>
                  <WhatsAppRespostasRapidas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/atendentes"
              element={
                <ProtectedRoute>
                  <WhatsAppAtendentes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/bots"
              element={
                <ProtectedRoute>
                  <WhatsAppBots />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/bots/:botId"
              element={
                <ProtectedRoute>
                  <WhatsAppBotEdit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/relatorio"
              element={
                <ProtectedRoute>
                  <WhatsAppRelatorio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/configuracoes"
              element={
                <ProtectedRoute>
                  <WhatsAppConfiguracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/canais"
              element={
                <ProtectedRoute>
                  <CanaisAtendimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/contatos"
              element={
                <ProtectedRoute>
                  <WhatsAppContatos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/monitor"
              element={
                <ProtectedRoute>
                  <WhatsAppMonitor />
                </ProtectedRoute>
              }
            />
            <Route
              path="/whatsapp/canais/webchat"
              element={
                <ProtectedRoute>
                  <WebchatConfig />
                </ProtectedRoute>
              }
            />
            <Route path="/assinar/:token" element={<AssinarOS />} />
            <Route path="/redefinir-senha" element={<RedefinirSenha />} />
            <Route
              path="/whatsapp/full"
              element={
                <ProtectedRoute>
                  <WhatsAppFull />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agenda/full"
              element={
                <ProtectedRoute>
                  <AgendaFull />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historico-ponto"
              element={
                <ProtectedRoute allowEmployee>
                  <HistoricoPonto />
                </ProtectedRoute>
              }
            />
            <Route
              path="/espelho-ponto"
              element={
                <ProtectedRoute allowEmployee>
                  <EspelhoPonto />
                </ProtectedRoute>
              }
            />
            <Route
              path="/comunicados"
              element={
                <ProtectedRoute allowEmployee>
                  <Comunicados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto"
              element={
                <ProtectedRoute allowEmployee>
                  <Ponto />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin"
              element={
                <ProtectedRoute>
                  <PontoDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/registros"
              element={
                <ProtectedRoute>
                  <PontoRegistros />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/espelho"
              element={
                <ProtectedRoute>
                  <PontoEspelho />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/funcionarios"
              element={
                <ProtectedRoute>
                  <PontoFuncionarios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/ajustes"
              element={
                <ProtectedRoute>
                  <PontoAjustes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/relatorios"
              element={
                <ProtectedRoute>
                  <PontoRelatorios />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/configuracoes"
              element={
                <ProtectedRoute>
                  <PontoConfiguracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/calendario"
              element={
                <ProtectedRoute>
                  <PontoCalendario />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/escalas"
              element={
                <ProtectedRoute>
                  <PontoEscalas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ponto-admin/fechamento"
              element={
                <ProtectedRoute>
                  <PontoFechamento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laudos"
              element={
                <ProtectedRoute>
                  <LaudosTecnicos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laudos/novo"
              element={
                <ProtectedRoute>
                  <NovoLaudo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laudos/editar/:id"
              element={
                <ProtectedRoute>
                  <EditarLaudo />
                </ProtectedRoute>
              }
            />
            <Route
              path="/laudos/:id"
              element={
                <ProtectedRoute>
                  <LaudoDetalhes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secretaria-ia"
              element={
                <ProtectedRoute>
                  <SecretariaIA />
                </ProtectedRoute>
              }
            />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
            <Route path="/lgpd" element={<LGPD />} />
            <Route path="/politica-de-cookies" element={<PoliticaDeCookies />} />

            {/* Portal do Cliente (público, sem auth do sistema) */}
            <Route path="/portal/login" element={<ClientPortalWrapper><PortalLogin /></ClientPortalWrapper>} />
            <Route path="/portal/dashboard" element={<ClientPortalWrapper><PortalDashboard /></ClientPortalWrapper>} />
            <Route path="/portal/servico/:id" element={<ClientPortalWrapper><PortalServiceDetails /></ClientPortalWrapper>} />
            <Route path="/portal/:slug" element={<PortalSlugResolver />} />
            <Route path="/portal/:slug/login" element={<PortalSlugResolver />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            </OfflineProvider>
            </ViewModeProvider>
            </DemoTourProvider>
            </SessionTrackerProvider>
          </AuthProvider>
          <CookieConsent />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
