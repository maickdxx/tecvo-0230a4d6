import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClientPortal, VerificationChannel } from "@/contexts/ClientPortalContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, Phone, ShieldCheck, ArrowLeft, Lock, MessageSquare, Mail } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

type Step = "phone" | "phone_otp" | "token_channels" | "token_otp";

interface TokenContext {
  sessionId: string;
  clientName: string;
  channels: VerificationChannel[];
  branding: { name: string | null; logo_url: string | null; primary_color: string | null };
  selectedChannel: string | null;
}

export default function PortalLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    session, sendOtp, verifyOtp, identifyToken,
    sendVerification, verifyTokenCode, validateToken,
  } = useClientPortal();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [clientName, setClientName] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenCtx, setTokenCtx] = useState<TokenContext | null>(null);

  // Handle token in URL — identify but don't grant access
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      setTokenLoading(true);
      // First check if this token already has a verified session
      validateToken(token).then(ok => {
        if (ok) {
          setTokenLoading(false);
          navigate("/portal/dashboard", { replace: true });
        } else {
          // Token exists but not verified — identify and show channels
          identifyToken(token).then(result => {
            setTokenLoading(false);
            if ("error" in result) {
              setError(result.error);
              setStep("phone");
            } else {
              setTokenCtx({
                sessionId: result.session_id,
                clientName: result.client_name,
                channels: result.channels,
                branding: result.branding,
                selectedChannel: null,
              });
              setStep("token_channels");
            }
          });
        }
      });
    }
  }, [searchParams]);

  useEffect(() => {
    if (session) navigate("/portal/dashboard", { replace: true });
  }, [session, navigate]);

  const handleSendOtp = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Digite um telefone válido com DDD");
      return;
    }
    setLoading(true);
    setError("");
    const result = await sendOtp(digits);
    setLoading(false);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSessionId(result.sessionId);
      setClientName(result.clientName);
      setStep("phone_otp");
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError("");
    const result = await verifyOtp(sessionId, otp);
    setLoading(false);
    if (result.success) {
      navigate("/portal/dashboard", { replace: true });
    } else {
      setError(result.error || "Código incorreto");
    }
  };

  const handleSelectChannel = async (channel: string) => {
    if (!tokenCtx) return;
    setLoading(true);
    setError("");
    const result = await sendVerification(tokenCtx.sessionId, channel);
    setLoading(false);
    if (result.success) {
      setTokenCtx({ ...tokenCtx, selectedChannel: channel });
      setOtp("");
      setStep("token_otp");
    } else {
      setError(result.error || "Erro ao enviar código");
    }
  };

  const handleVerifyTokenCode = async () => {
    if (!tokenCtx || otp.length < 4) return;
    setLoading(true);
    setError("");
    const result = await verifyTokenCode(tokenCtx.sessionId, otp);
    setLoading(false);
    if (result.success) {
      navigate("/portal/dashboard", { replace: true });
    } else {
      setError(result.error || "Código incorreto");
    }
  };

  const handleResendTokenCode = async () => {
    if (!tokenCtx?.selectedChannel) return;
    setLoading(true);
    setError("");
    setOtp("");
    await sendVerification(tokenCtx.sessionId, tokenCtx.selectedChannel);
    setLoading(false);
  };

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-blue-50/30">
        <div className="w-full max-w-sm px-4 space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="w-20 h-20 rounded-2xl" />
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  const brandName = tokenCtx?.branding?.name || "Área do Cliente";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50/30 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Brand header */}
        <div className="text-center mb-10">
          {tokenCtx?.branding?.logo_url ? (
            <img
              src={tokenCtx.branding.logo_url}
              alt={brandName}
              className="w-20 h-20 rounded-2xl object-contain mx-auto mb-5 shadow-lg"
            />
          ) : (
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-white mb-5 shadow-lg shadow-primary/20">
              <ShieldCheck className="h-9 w-9" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center">
                <Lock className="h-3 w-3 text-primary" />
              </div>
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            {brandName}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Acompanhe seus serviços com segurança
          </p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl shadow-xl shadow-black/5 border border-border/60 p-7">

          {/* ── STEP: Phone input ── */}
          {step === "phone" && (
            <div className="animate-fade-in">
              <label className="text-sm font-semibold text-foreground mb-2.5 block">
                Informe seu telefone
              </label>
              <p className="text-xs text-muted-foreground mb-4">
                Usaremos para identificar seus serviços
              </p>
              <div className="relative mb-5">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                  className="pl-11 h-13 text-base rounded-xl border-border/80 focus:border-primary focus:ring-primary/20"
                  onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                />
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                onClick={handleSendOtp}
                disabled={loading || phone.replace(/\D/g, "").length < 10}
                className="w-full h-13 text-base font-semibold rounded-xl shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar código de acesso
              </Button>

              <div className="flex items-center gap-2 justify-center mt-5 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Código de 6 dígitos via WhatsApp
              </div>
            </div>
          )}

          {/* ── STEP: Phone OTP (6 digits) ── */}
          {step === "phone_otp" && (
            <div className="animate-fade-in">
              <button
                onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Alterar telefone
              </button>

              {clientName && (
                <p className="text-base text-foreground mb-1">
                  Olá, <span className="font-bold">{clientName}</span> 👋
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-6">
                Digite o código enviado para seu WhatsApp
              </p>

              <div className="flex justify-center mb-5">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                    <InputOTPSlot index={1} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                    <InputOTPSlot index={2} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                    <InputOTPSlot index={3} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                    <InputOTPSlot index={4} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                    <InputOTPSlot index={5} className="w-11 h-12 text-lg font-semibold rounded-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                onClick={handleVerifyPhoneOtp}
                disabled={loading || otp.length < 6}
                className="w-full h-13 text-base font-semibold rounded-xl shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Acessar meus serviços
              </Button>

              <button
                onClick={() => { setOtp(""); setError(""); handleSendOtp(); }}
                className="w-full text-sm text-primary hover:text-primary/80 font-medium mt-4 transition-colors"
                disabled={loading}
              >
                Reenviar código
              </button>
            </div>
          )}

          {/* ── STEP: Token channel selection ── */}
          {step === "token_channels" && tokenCtx && (
            <div className="animate-fade-in">
              <p className="text-base text-foreground mb-1">
                Olá, <span className="font-bold">{tokenCtx.clientName}</span> 👋
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Para sua segurança, confirme sua identidade recebendo um código de verificação.
              </p>

              <div className="space-y-3 mb-5">
                {tokenCtx.channels.map((ch) => (
                  <button
                    key={ch.type}
                    onClick={() => handleSelectChannel(ch.type)}
                    disabled={loading}
                    className="w-full flex items-center gap-4 p-4 rounded-xl border border-border/80 hover:border-primary/50 hover:bg-primary/5 transition-all duration-200 text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                      {ch.type === "whatsapp" ? (
                        <MessageSquare className="h-5 w-5 text-primary" />
                      ) : (
                        <Mail className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{ch.label}</p>
                      <p className="text-xs text-muted-foreground">{ch.masked}</p>
                    </div>
                    {loading && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                <Lock className="h-3 w-3" />
                Código de 4 dígitos válido por 5 minutos
              </div>
            </div>
          )}

          {/* ── STEP: Token OTP verification (4 digits) ── */}
          {step === "token_otp" && tokenCtx && (
            <div className="animate-fade-in">
              <button
                onClick={() => { setStep("token_channels"); setOtp(""); setError(""); }}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Alterar canal
              </button>

              <p className="text-base text-foreground mb-1">
                Verificação de identidade
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Digite o código de 4 dígitos enviado via{" "}
                <span className="font-medium">
                  {tokenCtx.selectedChannel === "whatsapp" ? "WhatsApp" : "e-mail"}
                </span>
              </p>

              <div className="flex justify-center mb-5">
                <InputOTP maxLength={4} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-13 h-14 text-xl font-bold rounded-lg" />
                    <InputOTPSlot index={1} className="w-13 h-14 text-xl font-bold rounded-lg" />
                    <InputOTPSlot index={2} className="w-13 h-14 text-xl font-bold rounded-lg" />
                    <InputOTPSlot index={3} className="w-13 h-14 text-xl font-bold rounded-lg" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button
                onClick={handleVerifyTokenCode}
                disabled={loading || otp.length < 4}
                className="w-full h-13 text-base font-semibold rounded-xl shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Verificar e acessar
              </Button>

              <button
                onClick={handleResendTokenCode}
                className="w-full text-sm text-primary hover:text-primary/80 font-medium mt-4 transition-colors"
                disabled={loading}
              >
                Reenviar código
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground/60 mt-8">
          Powered by <span className="font-semibold text-muted-foreground/80">Tecvo</span>
        </p>
      </div>
    </div>
  );
}
