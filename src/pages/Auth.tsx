import { useState, useEffect, useRef } from "react";
import { analytics } from "@/lib/analytics";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { trackFBEvent } from "@/lib/fbPixel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInviteByToken } from "@/hooks/useInvites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Mail, ArrowLeft, RefreshCw } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  member: "Membro",
  employee: "Funcionário",
};

const GoogleIcon = () => (
  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const selectedPlan = searchParams.get("plan") as "starter" | "essential" | "pro" | null;

  const isSignupRoute = location.pathname === "/cadastro";

  const { signIn, signUp, refreshProfile, signUpSuccess, setSignUpSuccess } = useAuth();
  const { data: invite, isLoading: isLoadingInvite } = useInviteByToken(inviteToken);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">(isSignupRoute ? "signup" : "login");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const hasTrackedSignupStarted = useRef(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupWhatsapp, setSignupWhatsapp] = useState("");

  useEffect(() => {
    if (mode === "signup" && !hasTrackedSignupStarted.current) {
      analytics.track("signup_started", null, null);
      hasTrackedSignupStarted.current = true;
    }
  }, [mode]);

  useEffect(() => {
    if (invite) {
      setMode("signup");
      setSignupEmail(invite.email);
    }
  }, [invite]);

  useEffect(() => {
    if (selectedPlan && !invite) {
      setMode("signup");
    }
  }, [selectedPlan, invite]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const getRedirectPath = () => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      return returnTo;
    }
    if (selectedPlan === "starter" || selectedPlan === "essential" || selectedPlan === "pro") {
      return `/dashboard?checkout=${selectedPlan}`;
    }
    return "/";
  };

  const handleGoogleAuth = async () => {
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(loginEmail, loginPassword);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao entrar",
        description: error.message === "Invalid login credentials"
          ? "Email ou senha incorretos"
          : error.message === "Email not confirmed"
          ? "Email não confirmado. Verifique sua caixa de entrada."
          : error.message,
      });
      setIsLoading(false);
      return;
    }

    if (inviteToken) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const { data, error: fnError } = await supabase.functions.invoke("accept-invite", {
          body: { token: inviteToken },
          headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
        });
        if (fnError || data?.error) {
          toast({ variant: "destructive", title: "Erro ao aceitar convite", description: data?.error || "Não foi possível aceitar o convite" });
        } else {
          await refreshProfile();
          toast({ title: "Convite aceito!", description: "Você foi adicionado à organização com sucesso" });
        }
      } catch (err) {
        console.error("Error accepting invite:", err);
      }
    } else {
      toast({ title: "Bem-vindo!", description: "Login realizado com sucesso" });
    }

    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "A senha deve ter pelo menos 6 caracteres" });
      return;
    }
    setIsLoading(true);
    const cleanPhone = signupWhatsapp.replace(/\D/g, "");
    const { error } = await signUp(signupEmail, signupPassword, signupName, cleanPhone);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
    } else {
      trackFBEvent("Lead", { content_name: "Signup" });
      setConfirmationEmail(signupEmail);
      setResendCooldown(60);
    }
    setIsLoading(false);
  };

  const handleBackToLogin = () => {
    setSignUpSuccess(false);
    setOtpCode("");
    setMode("login");
    setLoginEmail(confirmationEmail);
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      toast({ variant: "destructive", title: "Erro", description: "Digite o código de 6 dígitos" });
      return;
    }
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-email-code", {
        body: { email: confirmationEmail, code: otpCode },
      });
      if (error || data?.error) {
        toast({ variant: "destructive", title: "Código inválido", description: data?.error || "Código inválido ou expirado" });
      } else if (data?.autoLogin && data?.token_hash) {
        const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: data.token_hash, type: "magiclink" });
        if (verifyError) {
          toast({ title: "E-mail confirmado!", description: "Faça login para começar" });
          handleBackToLogin();
        } else {
          toast({ title: "🎉 Conta criada!", description: "Bem-vindo à Tecvo!" });
          trackFBEvent("CompleteRegistration");
          setSignUpSuccess(false);
          navigate(getRedirectPath());
        }
      } else {
        toast({ title: "E-mail confirmado!", description: "Faça login para começar" });
        handleBackToLogin();
      }
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Erro ao verificar código" });
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResendCooldown(60);
    try {
      await supabase.functions.invoke("send-verification-email", {
        body: { email: confirmationEmail, fullName: signupName },
      });
      toast({ title: "Código reenviado!", description: "Verifique seu e-mail" });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível reenviar" });
    }
  };

  if (isLoadingInvite && inviteToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // OTP Verification Screen
  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Confirme seu e-mail</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Enviamos um código de 6 dígitos para
            </p>
            <p className="font-semibold text-foreground text-sm mt-1">{confirmationEmail}</p>
          </div>

          <div className="flex justify-center">
            <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <Button onClick={handleVerifyOtp} className="w-full h-12 text-base font-semibold" disabled={otpLoading || otpCode.length !== 6}>
            {otpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar código
          </Button>

          <div className="space-y-3">
            <button onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1">
              <RefreshCw className="h-3 w-3" />
              {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : "Reenviar código"}
            </button>
            <div>
              <button onClick={handleBackToLogin} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                Voltar para login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main auth screen — high conversion, zero distractions
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "signup"
              ? invite ? "Você foi convidado!" : "Crie sua conta gratuita"
              : "Acesse sua conta"}
          </h1>
          {mode === "signup" && !invite && (
            <p className="text-sm text-muted-foreground">Leva menos de 1 minuto</p>
          )}
          {mode === "signup" && !invite && (
            <p className="text-xs text-muted-foreground">Sem cartão de crédito • 7 dias grátis</p>
          )}
        </div>

        {/* Invite banner */}
        {invite && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <span className="font-medium text-foreground">Convite para</span>
            </div>
            <p className="font-semibold text-lg text-foreground">
              {invite.organizations?.name || "Organização"}
            </p>
            <Badge variant="secondary" className="mt-2">
              {ROLE_LABELS[invite.role] || invite.role}
            </Badge>
          </div>
        )}

        {/* Google CTA — primary action */}
        <Button
          type="button"
          className="w-full h-12 text-base font-semibold bg-foreground text-background hover:bg-foreground/90"
          onClick={handleGoogleAuth}
        >
          <GoogleIcon />
          {mode === "signup" ? "Continuar com Google" : "Entrar com Google"}
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">
              {mode === "signup" ? "ou cadastre com email" : "ou entre com email"}
            </span>
          </div>
        </div>

        {/* Login form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            {invite && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-foreground">
                Já tem uma conta? Faça login para aceitar o convite.
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="login-password">Senha</Label>
                <Link to="/redefinir-senha" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
              </div>
              <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required className="h-11" />
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invite ? "Entrar e Aceitar Convite" : "Entrar"}
            </Button>
          </form>
        )}

        {/* Signup form */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-name">Nome completo</Label>
              <Input id="signup-name" type="text" placeholder="João Silva" value={signupName} onChange={(e) => setSignupName(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required readOnly={!!invite} className={`h-11 ${invite ? "bg-muted" : ""}`} />
              {invite && <p className="text-xs text-muted-foreground">Email do convite (não pode ser alterado)</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Senha</Label>
              <Input id="signup-password" type="password" placeholder="Mínimo 6 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="signup-whatsapp" className="text-muted-foreground font-normal">
                WhatsApp <span className="text-xs">(opcional)</span>
              </Label>
              <Input
                id="signup-whatsapp"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={signupWhatsapp}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                  let formatted = digits;
                  if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                  if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                  setSignupWhatsapp(formatted);
                }}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Receba notificações e automações direto no seu WhatsApp</p>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="accept-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border accent-primary cursor-pointer"
                required
              />
              <label htmlFor="accept-terms" className="text-xs text-muted-foreground cursor-pointer select-none">
                Li e concordo com os{" "}
                <Link to="/termos-de-uso" target="_blank" className="text-primary hover:underline">Termos de Uso</Link>{" "}e a{" "}
                <Link to="/politica-de-privacidade" target="_blank" className="text-primary hover:underline">Política de Privacidade</Link>.
              </label>
            </div>
            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading || !acceptedTerms}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {invite ? "Aceitar Convite" : "Criar conta grátis"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">Leva menos de 1 minuto</p>
          </form>
        )}

        {/* Toggle login/signup */}
        <p className="text-sm text-center text-muted-foreground">
          {mode === "login" ? (
            <>Não tem uma conta?{" "}<button type="button" onClick={() => setMode("signup")} className="text-primary font-medium hover:underline">Criar conta</button></>
          ) : (
            <>Já tem uma conta?{" "}<button type="button" onClick={() => setMode("login")} className="text-primary font-medium hover:underline">Entrar</button></>
          )}
        </p>
      </div>
    </div>
  );
}
