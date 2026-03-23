import { 
  Smartphone, Share, MoreVertical, Plus, Download, Snowflake, 
  MessageSquare, LayoutDashboard, ChevronRight, CheckCircle2,
  Monitor, Globe
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

export default function Instalar() {
  const navigate = useNavigate();
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();

  return (
    <div className="min-h-screen bg-background p-4 safe-top safe-bottom">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-4 pt-8">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary shadow-lg">
            <Snowflake className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Instalar Tecvo</h1>
            <p className="text-muted-foreground mt-1">
              Instale no celular ou computador e acesse como um app nativo
            </p>
          </div>
        </div>

        {/* Install Button (Chrome/Edge — works on desktop and mobile) */}
        {isInstallable && (
          <Button onClick={promptInstall} size="lg" className="w-full gap-2 text-base">
            <Download className="h-5 w-5" />
            Instalar Tecvo agora
          </Button>
        )}

        {isInstalled && (
          <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">
                App instalado! Use os atalhos abaixo para acessar cada módulo.
              </p>
            </CardContent>
          </Card>
        )}

        {/* App 1 - Gestão */}
        <Card className="overflow-hidden border-2 border-primary/20 hover:border-primary/40 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-md">
                <LayoutDashboard className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">Tecvo Gestão</CardTitle>
                <CardDescription className="mt-0.5">Gestão completa da empresa</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {["Dashboard", "Agenda", "Ordens de Serviço", "Clientes", "Financeiro", "Relatórios", "Configurações"].map(m => (
                <span key={m} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {m}
                </span>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full gap-2 mt-2" 
              onClick={() => navigate("/dashboard")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Abrir Tecvo Gestão
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>

        {/* App 2 - Chat */}
        <Card className="overflow-hidden border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500 shadow-md">
                <MessageSquare className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">Tecvo Chat</CardTitle>
                <CardDescription className="mt-0.5">Atendimento rápido de clientes</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {["Conversas WhatsApp", "Etiquetas", "Chatbots", "Contatos", "Respostas Rápidas"].map(m => (
                <span key={m} className="inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {m}
                </span>
              ))}
            </div>
            <Button 
              variant="outline" 
              className="w-full gap-2 mt-2 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950" 
              onClick={() => navigate("/whatsapp")}
            >
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Abrir Tecvo Chat
              <ChevronRight className="h-4 w-4 ml-auto" />
            </Button>
          </CardContent>
        </Card>

        {/* Manual install instructions — shown when browser doesn't support beforeinstallprompt */}
        {!isInstallable && !isInstalled && (
          <>
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Para instalar, siga as instruções abaixo:
              </p>
            </div>

            {/* Desktop */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                    <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Computador (Chrome / Edge)</CardTitle>
                    <CardDescription>2 passos simples</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">1</div>
                  <div>
                    <p className="font-medium text-foreground">Clique no ícone de instalar</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Na barra de endereço, clique no ícone <Download className="h-4 w-4" /> ou <Globe className="h-4 w-4" />
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">2</div>
                  <div>
                    <p className="font-medium text-foreground">Confirme a instalação</p>
                    <p className="text-sm text-muted-foreground">Clique em "Instalar" na janela que aparecer</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Android */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                    <Smartphone className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Android (Chrome)</CardTitle>
                    <CardDescription>3 passos simples</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">1</div>
                  <div>
                    <p className="font-medium text-foreground">Abra o menu</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Toque nos três pontinhos <MoreVertical className="h-4 w-4" />
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">2</div>
                  <div>
                    <p className="font-medium text-foreground">Adicionar à tela inicial</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Selecione <Download className="h-4 w-4" /> "Adicionar à tela inicial"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">3</div>
                  <div>
                    <p className="font-medium text-foreground">Confirme</p>
                    <p className="text-sm text-muted-foreground">Toque em "Adicionar"</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* iOS */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <Smartphone className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">iPhone (Safari)</CardTitle>
                    <CardDescription>3 passos simples</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">1</div>
                  <div>
                    <p className="font-medium text-foreground">Abra o menu de compartilhar</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Toque no ícone <Share className="h-4 w-4" /> na barra inferior
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">2</div>
                  <div>
                    <p className="font-medium text-foreground">Adicionar à Tela de Início</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      Role e toque em <Plus className="h-4 w-4" /> "Adicionar à Tela de Início"
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">3</div>
                  <div>
                    <p className="font-medium text-foreground">Confirme</p>
                    <p className="text-sm text-muted-foreground">Toque em "Adicionar"</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Benefits */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <h3 className="font-semibold text-foreground mb-3">Vantagens do app instalado:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Acesso rápido pela tela inicial ou barra de tarefas
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Atalhos diretos: Gestão e Chat no menu do app
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Funciona em tela cheia, sem barra do navegador
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Funciona no celular e no computador
              </li>
              <li className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                Atualizações automáticas
              </li>
            </ul>
          </CardContent>
        </Card>

        <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
          Voltar para o app
        </Button>
      </div>
    </div>
  );
}
