import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signViaToken } from "@/hooks/useServiceSignatures";
import { Loader2, CheckCircle, PenLine, AlertTriangle } from "lucide-react";
import { SignatureCanvas, type SignatureCanvasRef } from "@/components/services/SignatureCanvas";

interface SignatureInfo {
  token: string;
  service_number: number;
  client_name: string;
  org_name: string;
  already_signed: boolean;
}

export default function AssinarOS() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SignatureInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      if (!token) { setError("Token inválido"); setLoading(false); return; }
      try {
        const { data: sigRows, error: sigErr } = await supabase
          .rpc("get_signature_by_token", { p_token: token });

        const sig = sigRows?.[0] || null;

        if (sigErr || !sig) { setError("Link inválido ou expirado"); setLoading(false); return; }

        if (sig.signature_url) {
          setInfo({ token, service_number: 0, client_name: "", org_name: "", already_signed: true });
          setLoading(false);
          return;
        }

        const { data: svc } = await supabase
          .from("services")
          .select("quote_number, client:clients(name), organization:organizations(name)")
          .eq("id", sig.service_id)
          .maybeSingle();

        setInfo({
          token,
          service_number: (svc as any)?.quote_number || 0,
          client_name: (svc as any)?.client?.name || "",
          org_name: (svc as any)?.organization?.name || "",
          already_signed: false,
        });
      } catch {
        setError("Erro ao carregar dados");
      }
      setLoading(false);
    }
    loadInfo();
  }, [token]);

  const handleSign = async (blob: Blob, signerName: string) => {
    if (!token) return;
    setIsSigning(true);
    try {
      await signViaToken(token, blob, signerName || "Cliente");
      setSigned(true);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar assinatura");
    }
    setIsSigning(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-2">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <p className="text-destructive font-semibold">{error}</p>
          <p className="text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  if (info?.already_signed || signed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-bold text-foreground">Assinatura Registrada!</h1>
          <p className="text-sm text-muted-foreground">
            A assinatura foi registrada com sucesso na ordem de serviço.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header info */}
        <div className="text-center space-y-1">
          {info?.org_name && (
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {info.org_name}
            </p>
          )}
          <h1 className="text-xl font-bold text-foreground">Assinar Ordem de Serviço</h1>
          {info?.service_number ? (
            <p className="text-sm text-muted-foreground">
              OS Nº {String(info.service_number).padStart(4, "0")}
              {info.client_name ? ` — ${info.client_name}` : ""}
            </p>
          ) : null}
        </div>

        {/* Unified Signature Canvas */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Desenhe sua assinatura</span>
          </div>

          <SignatureCanvas
            onSave={handleSign}
            height={200}
            showControls={true}
            showSignerName={true}
            signerNameRequired={true}
            signerNameLabel="Seu nome *"
            signerNamePlaceholder="Nome completo de quem está assinando"
            showConfirmButton={true}
            confirmLabel={isSigning ? "Salvando..." : "Confirmar Assinatura"}
            disabled={isSigning}
          />
        </div>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Ao assinar, você confirma o recebimento e a conclusão do serviço descrito na ordem de serviço.
        </p>
      </div>
    </div>
  );
}
