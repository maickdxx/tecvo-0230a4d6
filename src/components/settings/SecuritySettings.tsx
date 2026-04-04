import { useState } from "react";
import { ArrowLeft, Key, Monitor, Mail, Shield, Smartphone, Globe, Lock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface SecuritySettingsProps {
  onBack: () => void;
}

function parseUserAgent(ua: string): string {
  if (ua.includes("Chrome") && !ua.includes("Edg")) return "Google Chrome";
  if (ua.includes("Edg")) return "Microsoft Edge";
  if (ua.includes("Firefox")) return "Mozilla Firefox";
  if (ua.includes("Safari") && !ua.includes("Chrome")) return "Safari";
  if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
  return "Navegador desconhecido";
}

function getDeviceType(ua: string): string {
  if (/Mobi|Android/i.test(ua)) return "Celular";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Desktop";
}

export function SecuritySettings({ onBack }: SecuritySettingsProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [resending, setResending] = useState(false);
  const [endingSessions, setEndingSessions] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const emailVerified = !!user?.email_confirmed_at;
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString("pt-BR")
    : "Não disponível";
  const browserName = parseUserAgent(navigator.userAgent);
  const deviceType = getDeviceType(navigator.userAgent);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo de 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "A confirmação deve ser igual à nova senha.", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: "Senha alterada", description: "Sua senha foi atualizada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Erro ao alterar senha", description: err.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleEndAllSessions = async () => {
    setEndingSessions(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      toast({ title: "Sessões encerradas", description: "Você será redirecionado para o login." });
      navigate("/login");
    } catch {
      toast({ title: "Erro", description: "Não foi possível encerrar as sessões.", variant: "destructive" });
      setEndingSessions(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Email enviado", description: "Verifique sua caixa de entrada." });
      }
    } catch {
      toast({ title: "Erro", description: "Não foi possível reenviar o email.", variant: "destructive" });
    }
    setResending(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Segurança</h1>
          <p className="text-muted-foreground">Proteja sua conta e gerencie acessos</p>
        </div>
      </div>

      {/* Alterar senha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Key className="h-5 w-5 text-primary" />
            Login e autenticação
          </CardTitle>
          <CardDescription>Altere sua senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleChangePassword} disabled={changingPassword || !newPassword}>
            {changingPassword ? "Alterando..." : "Alterar senha"}
          </Button>
        </CardContent>
      </Card>

      {/* Sessões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Monitor className="h-5 w-5 text-primary" />
            Sessões ativas
          </CardTitle>
          <CardDescription>Gerencie os dispositivos conectados</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/30 p-4">
            {deviceType === "Celular" ? (
              <Smartphone className="h-8 w-8 text-primary" />
            ) : (
              <Globe className="h-8 w-8 text-primary" />
            )}
            <div className="flex-1">
              <p className="font-medium text-foreground">{browserName} — {deviceType}</p>
              <p className="text-sm text-muted-foreground">Sessão atual</p>
            </div>
            <Badge variant="outline" className="text-green-600 border-green-600">Ativa</Badge>
          </div>
          <Separator />
          <Button variant="destructive" onClick={handleEndAllSessions} disabled={endingSessions}>
            {endingSessions ? "Encerrando..." : "Encerrar todas as sessões"}
          </Button>
          <p className="text-xs text-muted-foreground">Isso desconectará todos os dispositivos, incluindo este.</p>
        </CardContent>
      </Card>

      {/* Acesso da conta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Acesso da conta
          </CardTitle>
          <CardDescription>Histórico de login</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Último login</p>
              <p className="font-medium text-foreground">{lastSignIn}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-sm text-muted-foreground">Dispositivo atual</p>
              <p className="font-medium text-foreground">{browserName} — {deviceType}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Verificações
          </CardTitle>
          <CardDescription>Status de verificação do email</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="font-medium text-foreground">{user?.email}</p>
              <p className="text-sm text-muted-foreground">Email da conta</p>
            </div>
            {emailVerified ? (
              <Badge className="bg-green-600 hover:bg-green-700">Verificado</Badge>
            ) : (
              <Badge variant="destructive">Não verificado</Badge>
            )}
          </div>
          {!emailVerified && (
            <Button variant="outline" size="sm" onClick={handleResendVerification} disabled={resending}>
              {resending ? "Enviando..." : "Reenviar verificação"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Zona de perigo */}
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <Trash2 className="h-5 w-5" />
            Zona de perigo
          </CardTitle>
          <CardDescription>Ações irreversíveis para sua conta</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Ao excluir sua conta, todos os seus dados serão removidos permanentemente, incluindo serviços, clientes, financeiro e configurações. Seu email ficará disponível para novo cadastro.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deletingAccount}>
                {deletingAccount ? "Excluindo..." : "Excluir minha conta"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Tem certeza que deseja excluir sua conta?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação é <strong>irreversível</strong>. Todos os seus dados serão excluídos permanentemente:
                  serviços, clientes, orçamentos, financeiro e configurações. Seu email será liberado para novo cadastro.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={async () => {
                    setDeletingAccount(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("delete-account");
                      if (error || data?.error) throw new Error(data?.error || error?.message);
                      await supabase.auth.signOut();
                      toast({ title: "Conta excluída", description: "Sua conta foi removida com sucesso." });
                      navigate("/login");
                    } catch (err: any) {
                      toast({ title: "Erro ao excluir conta", description: err.message || "Tente novamente.", variant: "destructive" });
                      setDeletingAccount(false);
                    }
                  }}
                >
                  Sim, excluir minha conta
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Proteção futura */}
      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-muted-foreground" />
            Proteção avançada
          </CardTitle>
          <CardDescription>Recursos adicionais de segurança</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <p className="font-medium text-muted-foreground">Autenticação em dois fatores (2FA)</p>
              <Badge variant="secondary">Em breve</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <p className="font-medium text-muted-foreground">Login por código</p>
              <Badge variant="secondary">Em breve</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
