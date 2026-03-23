import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Mail, KeyRound, ShieldCheck, ArrowLeft, RefreshCw, Wrench, Eye, EyeOff } from "lucide-react";

type Step = "email" | "otp" | "password";

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 20, label: "Muito fraca", color: "bg-destructive" };
  if (score === 2) return { score: 40, label: "Fraca", color: "bg-orange-500" };
  if (score === 3) return { score: 60, label: "Média", color: "bg-yellow-500" };
  if (score === 4) return { score: 80, label: "Forte", color: "bg-green-500" };
  return { score: 100, label: "Muito forte", color: "bg-green-600" };
}

function isStrongPassword(p: string) {
  return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
}

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const passwordStrength = newPassword ? getPasswordStrength(newPassword) : null;

  // Step 1: request code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    try {
      await supabase.functions.invoke("send-password-reset-code", {
        body: { email: email.trim() },
      });
      // Always show neutral message regardless of outcome
      toast({
        title: "Código enviado",
        description: "Se o e-mail estiver cadastrado, você receberá um código em instantes.",
      });
      setResendCooldown(60);
      setStep("otp");
    } catch {
      // Still advance to OTP step with neutral message
      setResendCooldown(60);
      setStep("otp");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: verify OTP
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      setErrorMsg("Digite o código de 6 dígitos.");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("verify-password-reset-code", {
        body: { email: email.trim(), code: otpCode },
      });
      if (error || data?.error) {
        setErrorMsg(data?.error || "Código inválido ou expirado.");
      } else if (data?.valid) {
        setStep("password");
      }
    } catch {
      setErrorMsg("Erro ao verificar código. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: set new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!isStrongPassword(newPassword)) {
      setErrorMsg("A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um símbolo.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg("As senhas não coincidem.");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-password-reset-code", {
        body: { email: email.trim(), code: otpCode, new_password: newPassword },
      });
      if (error || data?.error) {
        setErrorMsg(data?.error || "Erro ao redefinir senha.");
      } else {
        toast({
          title: "Senha redefinida com sucesso!",
          description: "Você será redirecionado para o login.",
        });
        setTimeout(() => navigate("/login"), 2000);
      }
    } catch {
      setErrorMsg("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setResendCooldown(60);
    setOtpCode("");
    setErrorMsg("");
    try {
      await supabase.functions.invoke("send-password-reset-code", {
        body: { email: email.trim() },
      });
      toast({ title: "Código reenviado!", description: "Verifique seu e-mail." });
    } catch {
      // silent
    }
  };

  const stepIcons: Record<Step, React.ReactNode> = {
    email: <Mail className="h-7 w-7 text-primary" />,
    otp: <KeyRound className="h-7 w-7 text-primary" />,
    password: <ShieldCheck className="h-7 w-7 text-primary" />,
  };

  const stepTitles: Record<Step, string> = {
    email: "Recuperar senha",
    otp: "Verificar código",
    password: "Nova senha",
  };

  const stepDescriptions: Record<Step, React.ReactNode> = {
    email: "Digite seu e-mail para receber um código de redefinição.",
    otp: (
      <>
        Enviamos um código para{" "}
        <span className="font-semibold text-foreground">{email}</span>
      </>
    ),
    password: "Escolha uma senha forte para sua conta.",
  };

  return (
    <div className="min-h-screen flex">
      {/* Branding column */}
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
          <h2 className="text-2xl font-bold leading-tight mb-3">Recuperação segura de senha</h2>
          <p className="text-primary-foreground/80 text-base leading-relaxed">
            Processo rápido e seguro para redefinir sua senha com verificação por código.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center pb-2">
            {/* Mobile logo */}
            <div className="lg:hidden mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Wrench className="h-6 w-6" />
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {(["email", "otp", "password"] as Step[]).map((s, i) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    s === step
                      ? "w-8 bg-primary"
                      : (["email", "otp", "password"] as Step[]).indexOf(s) <
                        (["email", "otp", "password"] as Step[]).indexOf(step)
                      ? "w-4 bg-primary/60"
                      : "w-4 bg-muted"
                  }`}
                />
              ))}
            </div>

            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              {stepIcons[step]}
            </div>
            <CardTitle className="text-2xl font-bold">{stepTitles[step]}</CardTitle>
            <CardDescription className="text-base mt-2">{stepDescriptions[step]}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 pt-4">
            {/* Step 1 — Email */}
            {step === "email" && (
              <form onSubmit={handleRequestCode} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail da conta</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar código
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate("/login")}
                    className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Voltar para o login
                  </button>
                </div>
              </form>
            )}

            {/* Step 2 — OTP */}
            {step === "otp" && (
              <div className="space-y-5">
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground text-center">
                  Se o e-mail estiver cadastrado, você receberá um código em instantes.
                </div>

                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpCode} onChange={(v) => { setOtpCode(v); setErrorMsg(""); }}>
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

                {errorMsg && (
                  <p className="text-sm font-medium text-destructive text-center">{errorMsg}</p>
                )}

                <Button
                  onClick={handleVerifyOtp}
                  className="w-full h-11 text-base font-semibold"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verificar código
                </Button>

                <div className="text-center space-y-3">
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendCooldown > 0}
                    className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {resendCooldown > 0 ? `Reenviar código (${resendCooldown}s)` : "Reenviar código"}
                  </button>
                  <div>
                    <button
                      type="button"
                      onClick={() => { setStep("email"); setOtpCode(""); setErrorMsg(""); }}
                      className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Alterar e-mail
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — New password */}
            {step === "password" && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(""); }}
                      required
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password strength bar */}
                  {newPassword && passwordStrength && (
                    <div className="space-y-1">
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.score}%` }}
                        />
                      </div>
                      <p className={`text-xs font-medium ${
                        passwordStrength.score <= 40 ? "text-destructive" :
                        passwordStrength.score <= 60 ? "text-yellow-600" : "text-green-600"
                      }`}>
                        {passwordStrength.label}
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Mín. 8 caracteres, 1 maiúscula, 1 número e 1 símbolo
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(""); }}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não coincidem</p>
                  )}
                </div>

                {errorMsg && (
                  <p className="text-sm font-medium text-destructive">{errorMsg}</p>
                )}

                <Button
                  type="submit"
                  className="w-full h-11 text-base font-semibold"
                  disabled={isLoading || !isStrongPassword(newPassword) || newPassword !== confirmPassword}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Redefinir senha
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
