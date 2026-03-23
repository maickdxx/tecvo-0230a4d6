import { useState, useRef, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, Loader2, Plus, Trash2, ArrowRight, PenLine, Eraser, RotateCcw, Link2 } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { useOrganization } from "@/hooks/useOrganization";
import type { ServicePaymentInput } from "@/hooks/useServicePayments";

interface PaymentLine {
  payment_method: string;
  amount: string;
  financial_account_id: string;
}

interface ServiceCompleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceValue: number;
  onConfirm: (payments: ServicePaymentInput[], signatureBlob?: Blob | null) => Promise<void>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function ServiceCompleteDialog({
  open,
  onOpenChange,
  serviceValue,
  onConfirm,
}: ServiceCompleteDialogProps) {
  const [lines, setLines] = useState<PaymentLine[]>([
    { payment_method: "", amount: serviceValue > 0 ? String(serviceValue) : "", financial_account_id: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientDidNotPay, setClientDidNotPay] = useState(false);
  const [step, setStep] = useState<"payment" | "signature">("payment");
  const [skipSignature, setSkipSignature] = useState(false);

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  const { paymentMethods, isLoading: isLoadingPM } = usePaymentMethods();
  const { activeAccounts, isLoading: isLoadingAccounts } = useFinancialAccounts();
  const { organization } = useOrganization();

  const requireClientSignature = organization?.require_client_signature ?? false;

  const allMethods = paymentMethods.filter((m) => m.installments === null);
  const creditCardMethods = paymentMethods.filter((m) => m.installments !== null);
  const methodOptions = [...allMethods, ...creditCardMethods];

  const totalPaid = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const diff = serviceValue - totalPaid;
  const isPaymentValid =
    clientDidNotPay ||
    (Math.abs(diff) < 0.01 &&
    lines.every((l) => l.payment_method && parseFloat(l.amount) > 0));

  const addLine = () => {
    const remaining = Math.max(0, serviceValue - totalPaid);
    setLines([...lines, { payment_method: "", amount: remaining > 0 ? String(remaining.toFixed(2)) : "", financial_account_id: "" }]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof PaymentLine, value: string) => {
    const updated = [...lines];
    updated[index] = { ...updated[index], [field]: value };
    if (field === "payment_method") {
      const selectedMethod = methodOptions.find((m) => m.slug === value);
      if (selectedMethod?.default_financial_account_id) {
        updated[index].financial_account_id = selectedMethod.default_financial_account_id;
      }
    }
    setLines(updated);
  };

  // Canvas setup
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
    if (step === "signature") {
      setTimeout(setupCanvas, 100);
    }
  }, [step, setupCanvas]);

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
  const clearCanvas = () => { setupCanvas(); setHasDrawn(false); };

  const getCanvasBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) { resolve(null); return; }
      canvas.toBlob((b) => resolve(b), "image/png", 0.9);
    });
  };

  const handleNextStep = () => {
    if (requireClientSignature) {
      setStep("signature");
    } else {
      handleFinalConfirm(null);
    }
  };

  const handleFinalConfirm = async (signatureBlob: Blob | null) => {
    setIsSubmitting(true);
    try {
      const payments: ServicePaymentInput[] = clientDidNotPay
        ? []
        : lines.map((l) => ({
            payment_method: l.payment_method,
            amount: parseFloat(l.amount),
            financial_account_id: l.financial_account_id,
          }));
      await onConfirm(payments, signatureBlob);
      onOpenChange(false);
      setStep("payment");
      setHasDrawn(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignAndConfirm = async () => {
    const blob = hasDrawn ? await getCanvasBlob() : null;
    await handleFinalConfirm(blob);
  };

  const handleSkipSignature = async () => {
    setSkipSignature(true);
    await handleFinalConfirm(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("payment");
      setHasDrawn(false);
      setSkipSignature(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "payment" ? "Concluir Serviço — Pagamento" : "Assinatura do Cliente"}
          </DialogTitle>
        </DialogHeader>

        {step === "payment" ? (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                <span className="text-sm font-medium text-muted-foreground">Valor Total</span>
                <span className="text-lg font-bold text-primary">{formatCurrency(serviceValue)}</span>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="clientDidNotPay"
                  checked={clientDidNotPay}
                  onCheckedChange={(checked) => setClientDidNotPay(checked === true)}
                />
                <Label htmlFor="clientDidNotPay" className="text-sm font-medium cursor-pointer">
                  Cliente não pagou
                </Label>
              </div>

              <div className={clientDidNotPay ? "opacity-40 pointer-events-none" : ""}>
                {lines.map((line, idx) => (
                  <div key={idx} className="rounded-lg border border-border p-3 space-y-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Pagamento {idx + 1}
                      </span>
                      {lines.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeLine(idx)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Forma de Pagamento *</Label>
                        <Select
                          value={line.payment_method}
                          onValueChange={(v) => updateLine(idx, "payment_method", v)}
                          disabled={isLoadingPM}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {methodOptions.map((m) => (
                              <SelectItem key={m.id} value={m.slug}>
                                {m.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-9"
                          value={line.amount}
                          onChange={(e) => updateLine(idx, "amount", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <Button variant="outline" size="sm" className="w-full" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar meio de pagamento
                </Button>

                {serviceValue > 0 && (
                  <div className={`text-sm text-center font-medium rounded-lg p-2 mt-3 ${
                    Math.abs(diff) < 0.01
                      ? "text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30"
                      : "text-destructive bg-destructive/10"
                  }`}>
                    {Math.abs(diff) < 0.01
                      ? "✅ Valores conferem"
                      : diff > 0
                      ? `Falta ${formatCurrency(diff)}`
                      : `Excede ${formatCurrency(Math.abs(diff))}`}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
              <Button onClick={handleNextStep} disabled={!isPaymentValid || isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : requireClientSignature ? (
                  <ArrowRight className="h-4 w-4 mr-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 mr-2" />
                )}
                {requireClientSignature ? "Próximo" : "Confirmar Conclusão"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 mb-1">
                <PenLine className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Peça ao cliente para assinar abaixo
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                O cliente pode assinar diretamente na tela do dispositivo.
              </p>

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

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="ghost" size="sm" onClick={handleSkipSignature} disabled={isSubmitting} className="text-muted-foreground">
                <Link2 className="h-4 w-4 mr-1" />
                Pular — enviar link depois
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("payment")}>
                  Voltar
                </Button>
                <Button onClick={handleSignAndConfirm} disabled={!hasDrawn || isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirmar
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
