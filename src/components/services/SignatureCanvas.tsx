import { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { Eraser, RotateCcw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SignatureCanvasRef {
  getBlob: () => Promise<Blob | null>;
  hasDrawn: boolean;
  clear: () => void;
}

interface SignatureCanvasProps {
  /** Called when signature is confirmed (blob + signer name) */
  onSave?: (blob: Blob, signerName: string) => void;
  height?: number;
  className?: string;
  /** Show clear/redo + confirm controls below canvas */
  showControls?: boolean;
  /** Show signer name input field */
  showSignerName?: boolean;
  /** Whether signer name is required */
  signerNameRequired?: boolean;
  /** Default signer name */
  defaultSignerName?: string;
  /** Label for the signer name field */
  signerNameLabel?: string;
  /** Placeholder for the signer name field */
  signerNamePlaceholder?: string;
  /** Show confirm button */
  showConfirmButton?: boolean;
  /** Confirm button label */
  confirmLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Called when drawing state changes */
  onDrawChange?: (hasDrawn: boolean) => void;
}

export const SignatureCanvas = forwardRef<SignatureCanvasRef, SignatureCanvasProps>(({
  onSave,
  height = 200,
  className,
  showControls = true,
  showSignerName = false,
  signerNameRequired = false,
  defaultSignerName = "",
  signerNameLabel = "Nome do assinante",
  signerNamePlaceholder = "Nome de quem está assinando",
  showConfirmButton = false,
  confirmLabel = "Confirmar Assinatura",
  disabled = false,
  onDrawChange,
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [confirmed, setConfirmed] = useState(false);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // Not mounted yet
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

  // Use ResizeObserver to reliably initialize canvas when it becomes visible
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setupCanvas();
        }
      }
    });

    observer.observe(canvas);
    // Also try immediate setup
    setupCanvas();

    return () => observer.disconnect();
  }, [setupCanvas]);

  const getBlob = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) { resolve(null); return; }
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.9);
    });
  }, [hasDrawn]);

  const clear = useCallback(() => {
    setupCanvas();
    setHasDrawn(false);
    setConfirmed(false);
  }, [setupCanvas]);

  useImperativeHandle(ref, () => ({
    getBlob,
    hasDrawn,
    clear,
  }), [getBlob, hasDrawn, clear]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || confirmed) return;
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
    if (!isDrawing || disabled || confirmed) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => setIsDrawing(false);

  const handleConfirm = async () => {
    const blob = await getBlob();
    if (blob && onSave) {
      onSave(blob, signerName);
      setConfirmed(true);
    }
  };

  const canConfirm = hasDrawn && (!signerNameRequired || signerName.trim().length > 0);

  return (
    <div className={className}>
      {/* Signer name input */}
      {showSignerName && (
        <div className="space-y-1.5 mb-3">
          <Label htmlFor="signer-name" className="text-sm">
            {signerNameLabel}{signerNameRequired ? " *" : ""}
          </Label>
          <Input
            id="signer-name"
            placeholder={signerNamePlaceholder}
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            disabled={disabled || confirmed}
          />
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="rounded-lg border-2 border-dashed border-border overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className={`w-full ${disabled || confirmed ? "cursor-not-allowed opacity-60" : "cursor-crosshair"}`}
          style={{ height, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {/* Confirmed feedback */}
      {confirmed && (
        <div className="flex items-center gap-2 mt-2 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          <CheckCircle className="h-4 w-4" />
          Assinatura capturada com sucesso
        </div>
      )}

      {/* Controls */}
      {showControls && !confirmed && (
        <div className="flex gap-2 flex-wrap mt-2">
          <Button variant="outline" size="sm" onClick={clear} disabled={!hasDrawn || disabled}>
            <Eraser className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <Button variant="outline" size="sm" onClick={clear} disabled={!hasDrawn || disabled}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Refazer
          </Button>
        </div>
      )}

      {/* Confirm button */}
      {showConfirmButton && !confirmed && (
        <Button
          className="w-full mt-3"
          size="lg"
          onClick={handleConfirm}
          disabled={!canConfirm || disabled}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {confirmLabel}
        </Button>
      )}
    </div>
  );
});

SignatureCanvas.displayName = "SignatureCanvas";
