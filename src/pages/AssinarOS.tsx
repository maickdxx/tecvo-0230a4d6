import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { signViaToken } from "@/hooks/useServiceSignatures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, Loader2, PenLine, Eraser, RotateCcw } from "lucide-react";

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
  const [signerName, setSignerName] = useState("");
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  // Canvas state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  useEffect(() => {
    async function loadInfo() {
      if (!token) { setError("Token inválido"); setLoading(false); return; }
      try {
        // Load signature record via secure RPC (requires exact token)
        const { data: sigRows, error: sigErr } = await supabase
          .rpc("get_signature_by_token", { p_token: token });

        const sig = sigRows?.[0] || null;

        if (sigErr || !sig) { setError("Link inválido ou expirado"); setLoading(false); return; }

        if (sig.signature_url) {
          setInfo({ token, service_number: 0, client_name: "", org_name: "", already_signed: true });
          setLoading(false);
          return;
        }

        // Get service + client + org info
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

  useEffect(() => {
    if (info && !info.already_signed) {
      setTimeout(setupCanvas, 100);
    }
  }, [info, setupCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => setIsDrawing(false);

  const clearCanvas = () => {
    setupCanvas();
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!token || !canvasRef.current) return;
    setIsSigning(true);
    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvasRef.current!.toBlob((b) => resolve(b), "image/png", 0.9);
      });
      if (!blob) { setIsSigning(false); return; }
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

        {/* Signer name */}
        <div className="space-y-1.5">
          <Label htmlFor="signer-name" className="text-sm">Seu nome (opcional)</Label>
          <Input
            id="signer-name"
            placeholder="Nome de quem está assinando"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
          />
        </div>

        {/* Canvas */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <PenLine className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Desenhe sua assinatura</span>
          </div>
          <div className="rounded-lg border-2 border-dashed border-border overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair"
              style={{ height: 200, touchAction: "none" }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
              <Eraser className="h-4 w-4 mr-1" /> Limpar
            </Button>
            <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
              <RotateCcw className="h-4 w-4 mr-1" /> Refazer
            </Button>
          </div>
        </div>

        {/* Confirm */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSign}
          disabled={!hasDrawn || isSigning}
        >
          {isSigning ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <CheckCircle className="h-4 w-4 mr-2" />
          )}
          Confirmar Assinatura
        </Button>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Ao assinar, você confirma o recebimento e a conclusão do serviço descrito na ordem de serviço.
        </p>
      </div>
    </div>
  );
}
