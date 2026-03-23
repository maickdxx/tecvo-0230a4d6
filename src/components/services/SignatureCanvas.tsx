import { useRef, useState, useEffect, useCallback } from "react";
import { Eraser, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SignatureCanvasProps {
  onSave: (blob: Blob) => void;
  height?: number;
  className?: string;
  /** If true, shows clear/redo buttons below canvas */
  showControls?: boolean;
}

export function SignatureCanvas({ onSave, height = 180, className, showControls = true }: SignatureCanvasProps) {
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

  const handlePointerUp = () => setIsDrawing(false);

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
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return false;
    }
    return true;
  };

  const getBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas || isCanvasEmpty()) { resolve(null); return; }
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.9);
    });
  };

  // Expose getBlob and hasDrawn through imperative handle-like pattern
  // Parent can call onSave directly; we also expose a helper
  const handleSave = async () => {
    const blob = await getBlob();
    if (blob) onSave(blob);
  };

  return (
    <div className={className}>
      <div className="rounded-lg border-2 border-dashed border-border overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height, touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
      </div>

      {showControls && (
        <div className="flex gap-2 flex-wrap mt-2">
          <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
            <Eraser className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <Button variant="outline" size="sm" onClick={clearCanvas} disabled={!hasDrawn}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Refazer
          </Button>
        </div>
      )}

      {/* Hidden trigger - parent can call handleSave via ref or we expose it */}
      <button
        type="button"
        className="hidden"
        data-signature-save
        onClick={handleSave}
      />
    </div>
  );
}

// Hook-friendly version that exposes canvas ref and methods
export function useSignatureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const getBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) { resolve(null); return; }
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(null); return; }
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      let isEmpty = true;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) { isEmpty = false; break; }
      }
      if (isEmpty) { resolve(null); return; }
      canvas.toBlob((blob) => resolve(blob), "image/png", 0.9);
    });
  };

  return { canvasRef, getBlob };
}
