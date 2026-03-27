import { useState, useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { useNavigate, useSearchParams, Link, useLocation } from "react-router-dom";
import { trackFBEvent } from "@/lib/fbPixel";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useInviteByToken } from "@/hooks/useInvites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Wrench, UserPlus, Star, Crown, CreditCard, Shield, BarChart3, Users, Mail, ArrowLeft, RefreshCw, Chrome, CalendarCheck, FileText, DollarSign, CheckCircle2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
// supabase already imported above
import { PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";
import { useIsMobile } from "@/hooks/use-mobile";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  member: "Membro",
  employee: "Funcionário",
};

function getPlanInfo(slug: string | null) {
  if (!slug || !(slug in PLAN_CONFIG)) return null;
  const plan = PLAN_CONFIG[slug as Exclude<PlanSlug, "free">];
  return {
    name: plan.name,
    price: `${plan.price}${plan.period}`,
    icon: slug === "pro" ? Crown : Star,
  };
}

const benefits = [
  { icon: CalendarCheck, title: "Agenda organizada", desc: "Agenda de serviços simples e organizada" },
  { icon: FileText, title: "OS profissionais", desc: "Ordens de serviço profissionais em segundos" },
  { icon: DollarSign, title: "Controle financeiro", desc: "Controle financeiro sem dor de cabeça" },
  { icon: Shield, title: "Segurança total", desc: "Dados protegidos com criptografia de ponta" },
];

const mobileBullets = [
  { icon: CalendarCheck, text: "Agenda de instalações e limpezas organizada" },
  { icon: FileText, text: "Ordens de serviço profissionais para seus clientes" },
  { icon: DollarSign, text: "Controle financeiro sem dor de cabeça" },
];

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const selectedPlan = searchParams.get("plan") as "starter" | "essential" | "pro" | null;
  const isMobile = useIsMobile();
  
  const isSignupRoute = location.pathname === "/cadastro";
  
  const { signIn, signUp, refreshProfile, signUpSuccess, setSignUpSuccess } = useAuth();
  const { data: invite, isLoading: isLoadingInvite } = useInviteByToken(inviteToken);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [activeTab, setActiveTab] = useState(isSignupRoute ? "signup" : "login");
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (activeTab === "signup") {
      analytics.track("signup_started", null, null);
    }
  }, [activeTab]);

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  useEffect(() => {
    if (invite) {
      setActiveTab("signup");
      setSignupEmail(invite.email);
    }
  }, [invite]);

  useEffect(() => {
    if (selectedPlan && !invite) {
      setActiveTab("signup");
    }
  }, [selectedPlan, invite]);

  // Resend cooldown timer
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
          headers: {
            Authorization: `Bearer ${sessionData.session?.access_token}`,
          },
        });

        if (fnError || data?.error) {
          toast({
            variant: "destructive",
            title: "Erro ao aceitar convite",
            description: data?.error || "Não foi possível aceitar o convite",
          });
        } else {
          await refreshProfile();
          toast({
            title: "Convite aceito!",
            description: "Você foi adicionado à organização com sucesso",
          });
        }
      } catch (err) {
        console.error("Error accepting invite:", err);
      }
    } else {
      toast({
        title: "Bem-vindo!",
        description: "Login realizado com sucesso",
      });
    }

    navigate(getRedirectPath());
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (signupPassword !== signupConfirmPassword) {
      toast({ variant: "destructive", title: "Erro", description: "As senhas não coincidem" });
      return;
    }

    if (signupPassword.length < 6) {
      toast({ variant: "destructive", title: "Erro", description: "A senha deve ter pelo menos 6 caracteres" });
      return;
    }

    const cleanPhone = signupPhone.replace(/\D/g, "");
    if (cleanPhone.length < 11) {
      toast({ variant: "destructive", title: "Erro", description: "Informe um número de celular válido com DDD" });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, signupName, signupPhone);

    if (error) {
      toast({ variant: "destructive", title: "Erro ao criar conta", description: error.message });
    } else {
      trackFBEvent("Lead", { content_name: "Signup" });
      analytics.track("signup_completed", null, null, { email: signupEmail });
      setConfirmationEmail(signupEmail);
      setResendCooldown(60);
    }
    setIsLoading(false);
  };

  const handleBackToLogin = () => {
    setSignUpSuccess(false);
    setOtpCode("");
    setActiveTab("login");
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
        // Auto-login: use the magic link token to create a session
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: data.token_hash,
          type: "magiclink",
        });
        if (verifyError) {
          console.warn("Auto-login failed, falling back to manual login:", verifyError);
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const planInfo = getPlanInfo(selectedPlan);
  const PlanIcon = planInfo?.icon || Star;

  // OTP Verification Screen (after successful signup)
  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex">
        {!isMobile && <BrandingColumn />}

        <div className="flex-1 flex items-center justify-center p-6 bg-background">
          <Card className="w-full max-w-md border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <Mail className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold">Confirme seu e-mail</CardTitle>
              <CardDescription className="text-base mt-2">
                Enviamos um código de 6 dígitos para
              </CardDescription>
              <p className="font-semibold text-foreground text-sm mt-1">
                {confirmationEmail}
              </p>
            </CardHeader>
            <CardContent className="space-y-6 pt-4">
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

              <Button
                onClick={handleVerifyOtp}
                className="w-full h-12 text-base font-semibold"
                disabled={otpLoading || otpCode.length !== 6}
              >
                {otpLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar código
              </Button>

              <div className="text-center space-y-3">
                <button
                  onClick={handleResendOtp}
                  disabled={resendCooldown > 0}
                  className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : "Reenviar código"}
                </button>

                <div>
                  <button
                    onClick={handleBackToLogin}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar para login
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {!isMobile && <BrandingColumn />}

      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        {/* Mobile value proposition — only on signup */}
        {isMobile && activeTab === "signup" && (
          <div className="w-full max-w-md mb-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-1.5 tracking-tight">
              Organize seus atendimentos de ar-condicionado em um só lugar
            </h1>
            <p className="text-sm text-muted-foreground mb-5">
              Controle sua operação sem planilhas e sem complicação
            </p>
            <div className="flex flex-col gap-2.5 text-left mb-5">
              {mobileBullets.map((b) => (
                <div key={b.text} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground">{b.text}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground font-medium">
              Mais de 50 empresas já usam a Tecvo
            </p>
          </div>
        )}

        {/* Mobile login — minimal branding */}
        {isMobile && activeTab === "login" && (
          <div className="w-full max-w-md mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-6 w-6" />
            </div>
          </div>
        )}

        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {invite ? "Você foi convidado!" : activeTab === "signup" ? "Configure sua conta em menos de 30 segundos" : "Acesse sua conta"}
            </CardTitle>
            <CardDescription className="text-base">
              {invite ? "Crie sua conta para aceitar o convite" : planInfo ? "Comece seu teste gratuito de 7 dias" : activeTab === "signup" ? "Sem cartão de crédito. Comece grátis agora." : "Gestão de serviços técnicos"}
            </CardDescription>

            {invite && (
              <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
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

            {planInfo && !invite && (
              <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">Plano Selecionado</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <PlanIcon className="h-5 w-5 text-primary" />
                  <p className="font-semibold text-lg text-foreground">{planInfo.name}</p>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{planInfo.price}</p>
                <p className="text-sm font-medium text-green-600 mt-2">✓ 7 dias de teste grátis</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Sem cobrança imediata. Após criar sua conta, você será direcionado para o checkout.
                </p>
              </div>
            )}
          </CardHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mx-6" style={{ width: "calc(100% - 48px)" }}>
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar Conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin}>
                <CardContent className="space-y-4">
                  {invite && (
                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-foreground">
                      Já tem uma conta? Faça login para aceitar o convite.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Senha</Label>
                      <Link
                        to="/redefinir-senha"
                        className="text-xs text-primary hover:underline"
                      >
                        Esqueci minha senha
                      </Link>
                    </div>
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {invite ? "Entrar e Aceitar Convite" : "Entrar na minha conta"}
                  </Button>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={async () => {
                      await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Entrar com Google
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <Input id="signup-name" type="text" placeholder="João Silva" value={signupName} onChange={(e) => setSignupName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required readOnly={!!invite} className={invite ? "bg-muted" : ""} />
                    {invite && <p className="text-xs text-muted-foreground">Email do convite (não pode ser alterado)</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-phone">Celular / WhatsApp</Label>
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      value={signupPhone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                        let formatted = digits;
                        if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                        if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                        setSignupPhone(formatted);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <Input id="signup-password" type="password" placeholder="••••••••" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirmar Senha</Label>
                    <Input id="signup-confirm" type="password" placeholder="••••••••" value={signupConfirmPassword} onChange={(e) => setSignupConfirmPassword(e.target.value)} required />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
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
                    {invite ? "Aceitar Convite" : planInfo ? "Criar Conta e Assinar" : "Criar conta grátis"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">Leva menos de 30 segundos</p>
                  <div className="relative w-full">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">ou</span></div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11"
                    onClick={async () => {
                      await lovable.auth.signInWithOAuth("google", {
                        redirect_uri: window.location.origin,
                      });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Criar conta com Google
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function BrandingColumn() {
  return (
    <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-center p-12 bg-gradient-to-br from-primary via-primary to-primary/80 text-primary-foreground relative overflow-hidden">
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-20 -left-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
        <div className="absolute bottom-20 -right-10 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tecvo</h1>
            <p className="text-sm text-primary-foreground/80">Gestão de Serviços Técnicos</p>
          </div>
        </div>

        <h2 className="text-2xl font-bold leading-tight mb-3">
          Organize seus atendimentos de ar-condicionado em um só lugar
        </h2>
        <p className="text-primary-foreground/80 mb-10 text-base leading-relaxed">
          Controle sua operação sem planilhas e sem complicação.
        </p>

        <div className="space-y-5">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <b.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">{b.title}</p>
                <p className="text-primary-foreground/70 text-sm">{b.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
