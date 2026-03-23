import { useRef, useState, useEffect, useCallback } from "react";
import { ArrowLeft, Eraser, Save, Trash2, RotateCcw, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "@/hooks/use-toast";

interface SignatureSettingsProps {
  onBack: () => void;
}

export function SignatureSettings({ onBack }: SignatureSettingsProps) {
  const {
    organization,
    uploadSignature,
    isUploadingSignature,
    removeSignature,
    isRemovingSignature,
    toggleAutoSignatureOS,
    toggleRequireClientSignature,
  } = useOrganization();

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
    setupCanvas();
  }, [setupCanvas]);

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

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    setupCanvas();
    setHasDrawn(false);
  };

  const isCanvasEmpty = (): boolean => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    // Check if all pixels are white
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) {
        return false;
      }
    }
    return true;
  };

  const handleSave = () => {
    if (isCanvasEmpty()) {
      toast({
        variant: "destructive",
        title: "Canvas vazio",
        description: "Desenhe sua assinatura antes de salvar.",
      });
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        uploadSignature(blob);
        setHasDrawn(false);
      },
      "image/png",
      0.9
    );
  };

  const handleRemove = () => {
    removeSignature();
    clearCanvas();
  };

  const handleToggle = (checked: boolean) => {
    toggleAutoSignatureOS(checked);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Assinatura da Empresa</h1>
          <p className="text-muted-foreground text-sm">
            Assinatura digital para ordens de serviço
          </p>
        </div>
      </div>

      {/* Saved signature preview */}
      {organization?.signature_url && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-card-foreground">Assinatura Atual</h3>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              disabled={isRemovingSignature}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-white p-4 flex items-center justify-center">
            <img
              src={organization.signature_url}
              alt="Assinatura da empresa"
              className="max-h-24 max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Canvas area */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <PenLine className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">
            {organization?.signature_url ? "Refazer Assinatura" : "Desenhar Assinatura"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Use o dedo, mouse ou caneta para desenhar a assinatura da empresa.
        </p>

        <div className="rounded-lg border-2 border-dashed border-border overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ height: 180, touchAction: "none" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
            <Eraser className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Refazer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!hasDrawn || isUploadingSignature}>
            <Save className="h-4 w-4 mr-1" />
            {isUploadingSignature ? "Salvando..." : "Salvar assinatura"}
          </Button>
        </div>
      </div>

      {/* Auto-include toggle */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="auto-signature" className="text-sm font-semibold">
              Incluir assinatura automaticamente na Ordem de Serviço
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativado, toda OS gerada incluirá a assinatura da empresa automaticamente.
            </p>
          </div>
          <Switch
            id="auto-signature"
            checked={organization?.auto_signature_os ?? false}
            onCheckedChange={handleToggle}
            disabled={!organization?.signature_url}
          />
        </div>
        {!organization?.signature_url && (
          <p className="text-xs text-muted-foreground italic">
            Salve uma assinatura primeiro para ativar esta opção.
          </p>
      )}
      </div>

      {/* Require client signature toggle */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="require-client-sig" className="text-sm font-semibold">
              Solicitar assinatura do cliente ao concluir serviço
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativado, será solicitada a assinatura do cliente após o pagamento ao concluir o serviço.
            </p>
          </div>
          <Switch
            id="require-client-sig"
            checked={organization?.require_client_signature ?? false}
            onCheckedChange={(checked) => toggleRequireClientSignature(checked)}
          />
        </div>
      </div>

      {/* Informative text */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground leading-relaxed">
          A assinatura da empresa neste documento representa apenas a emissão formal da Ordem de
          Serviço e não confirma a execução do serviço, que depende da realização e aceite final do
          cliente.
        </p>
      </div>
    </div>
  );
}
