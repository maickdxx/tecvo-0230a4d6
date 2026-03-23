import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, X, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SelfieCaptureProps {
  open: boolean;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}

export function SelfieCapture({ open, onCapture, onCancel }: SelfieCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const cleanup = useCallback(() => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCaptured(null);
    setPreviewUrl(null);
    setError(null);
  }, [stopCamera, previewUrl]);

  // Ensure camera is stopped when component unmounts or dialog closes
  useEffect(() => {
    if (!open) {
      // Small delay to ensure dialog animation completes
      const timer = setTimeout(() => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
    }
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCaptured(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          stopCamera();
        }
      },
      "image/jpeg",
      0.8
    );
  }, [stopCamera]);

  const retake = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setCaptured(null);
    setPreviewUrl(null);
    startCamera();
  }, [previewUrl, startCamera]);

  const confirm = useCallback(() => {
    if (captured) {
      onCapture(captured);
      cleanup();
    }
  }, [captured, onCapture, cleanup]);

  const handleCancel = () => {
    cleanup();
    onCancel();
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      startCamera();
    } else {
      handleCancel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Selfie para Registro
          </DialogTitle>
        </DialogHeader>

        <div className="relative bg-black aspect-[4/3] w-full">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
              <p className="text-sm">{error}</p>
            </div>
          ) : previewUrl ? (
            <img src={previewUrl} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-4 flex gap-2 justify-center">
          {error ? (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={startCamera}>
                <Camera className="h-4 w-4 mr-1" /> Tentar Novamente
              </Button>
            </>
          ) : captured ? (
            <>
              <Button variant="outline" onClick={retake}>
                <RotateCcw className="h-4 w-4 mr-1" /> Nova Foto
              </Button>
              <Button onClick={confirm}>
                <Check className="h-4 w-4 mr-1" /> Confirmar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button onClick={takePhoto} disabled={!cameraActive} size="lg" className="px-8">
                <Camera className="h-5 w-5 mr-2" /> Capturar
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
