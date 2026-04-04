import { useState, useRef, useMemo } from "react";
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
import { CheckCircle, Loader2, Plus, Trash2, ArrowRight, PenLine, Link2, TrendingDown, Sparkles } from "lucide-react";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { useOrganization } from "@/hooks/useOrganization";
import { SignatureCanvas, type SignatureCanvasRef } from "./SignatureCanvas";
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
  onConfirm: (payments: ServicePaymentInput[], signatureBlob?: Blob | null, signerName?: string, sendReceipt?: boolean) => Promise<void>;
  showReceiptOption?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

/** Calculate fee for a given method and amount */
function calcFee(method: { fee_type: string; fee_value: number } | undefined, amount: number) {
  if (!method || !amount || amount <= 0) return { fee: 0, net: amount };
  const fee =
    method.fee_type === "percentage"
      ? amount * (method.fee_value / 100)
      : method.fee_value;
  return { fee: Math.round(fee * 100) / 100, net: Math.round((amount - fee) * 100) / 100 };
}

export function ServiceCompleteDialog({
  open,
  onOpenChange,
  serviceValue,
  onConfirm,
  showReceiptOption = false,
}: ServiceCompleteDialogProps) {
  const [lines, setLines] = useState<PaymentLine[]>([
    { payment_method: "", amount: serviceValue > 0 ? String(serviceValue) : "", financial_account_id: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientDidNotPay, setClientDidNotPay] = useState(false);
  const [step, setStep] = useState<"payment" | "signature">("payment");
  const [signerName, setSignerName] = useState("");
  const [sendReceipt, setSendReceipt] = useState(showReceiptOption);
  const [hasSignatureDrawn, setHasSignatureDrawn] = useState(false);
  const signatureRef = useRef<SignatureCanvasRef>(null);

  const { paymentMethods, isLoading: isLoadingPM } = usePaymentMethods();
  const { activeAccounts, isLoading: isLoadingAccounts } = useFinancialAccounts();
  const { organization } = useOrganization();

  const requireClientSignature = organization?.require_client_signature ?? false;

  const allMethods = paymentMethods.filter((m) => m.installments === null);
  const creditCardMethods = paymentMethods.filter((m) => m.installments !== null);
  const methodOptions = [...allMethods, ...creditCardMethods];

  // Build slug -> method map for fee lookup
  const methodMap = useMemo(() => {
    const map = new Map<string, { fee_type: string; fee_value: number; name: string }>();
    for (const m of methodOptions) {
      map.set(m.slug, { fee_type: m.fee_type, fee_value: m.fee_value, name: m.name });
    }
    return map;
  }, [methodOptions]);

  const totalPaid = lines.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
  const diff = serviceValue - totalPaid;
  const isPaymentValid =
    clientDidNotPay ||
    (Math.abs(diff) < 0.01 &&
    lines.every((l) => l.payment_method && parseFloat(l.amount) > 0));

  // Calculate total fees across all lines
  const totalFees = useMemo(() => {
    if (clientDidNotPay) return 0;
    return lines.reduce((sum, l) => {
      const method = methodMap.get(l.payment_method);
      const amount = parseFloat(l.amount) || 0;
      return sum + calcFee(method, amount).fee;
    }, 0);
  }, [lines, methodMap, clientDidNotPay]);

  // Find lowest-fee method for suggestion
  const bestMethod = useMemo(() => {
    if (serviceValue <= 0 || methodOptions.length === 0) return null;
    let best: { slug: string; name: string; fee: number } | null = null;
    for (const m of methodOptions) {
      const { fee } = calcFee({ fee_type: m.fee_type, fee_value: m.fee_value }, serviceValue);
      if (!best || fee < best.fee) {
        best = { slug: m.slug, name: m.name, fee };
      }
    }
    return best;
  }, [serviceValue, methodOptions]);

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
      await onConfirm(payments, signatureBlob, signerName || undefined, sendReceipt);
      onOpenChange(false);
      setStep("payment");
      setSignerName("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignAndConfirm = async () => {
    const blob = signatureRef.current?.hasDrawn ? await signatureRef.current.getBlob() : null;
    if (requireClientSignature && !blob) return;
    await handleFinalConfirm(blob);
  };

  const handleSkipSignature = async () => {
    await handleFinalConfirm(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setStep("payment");
      setSignerName("");
      setHasSignatureDrawn(false);
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
                {lines.map((line, idx) => {
                  const selectedMethod = methodMap.get(line.payment_method);
                  const lineAmount = parseFloat(line.amount) || 0;
                  const { fee, net } = calcFee(selectedMethod, lineAmount);
                  const hasFee = fee > 0.01;

                  return (
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
                                  {m.fee_value > 0 && (
                                    <span className="text-muted-foreground ml-1">
                                      ({m.fee_type === "percentage" ? `${m.fee_value}%` : formatCurrency(m.fee_value)})
                                    </span>
                                  )}
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

                      {/* Inline fee indicator */}
                      {line.payment_method && lineAmount > 0 && (
                        <div className={`flex items-center justify-between text-xs rounded px-2 py-1.5 ${
                          hasFee ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        }`}>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />
                            <span>
                              {hasFee
                                ? `Taxa: -${formatCurrency(fee)} (${selectedMethod?.fee_type === "percentage" ? `${selectedMethod.fee_value}%` : "fixa"})`
                                : "Sem taxa"}
                            </span>
                          </div>
                          <span className="font-medium">
                            Líquido: {formatCurrency(net)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}

                <Button variant="outline" size="sm" className="w-full" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar meio de pagamento
                </Button>

                {serviceValue > 0 && (
                  <div className={`text-sm text-center font-medium rounded-lg p-2 mt-3 ${
                    Math.abs(diff) < 0.01
                      ? "text-primary bg-primary/10"
                      : "text-destructive bg-destructive/10"
                  }`}>
                    {Math.abs(diff) < 0.01
                      ? "✅ Valores conferem"
                      : diff > 0
                      ? `Falta ${formatCurrency(diff)}`
                      : `Excede ${formatCurrency(Math.abs(diff))}`}
                  </div>
                )}

                {/* Total fee summary + suggestion */}
                {totalFees > 0.01 && Math.abs(diff) < 0.01 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 mt-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Total em taxas</span>
                      <span className="font-semibold text-destructive">-{formatCurrency(totalFees)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Líquido estimado</span>
                      <span className="font-semibold text-foreground">{formatCurrency(serviceValue - totalFees)}</span>
                    </div>
                  </div>
                )}

                {/* Best method suggestion */}
                {bestMethod && bestMethod.fee === 0 && totalFees > 0.01 && (
                  <div className="flex items-center gap-2 rounded-lg bg-accent/50 p-2.5 mt-2 text-xs text-accent-foreground">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{bestMethod.name}</strong> tem menor custo para a empresa (sem taxa)
                    </span>
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

              <SignatureCanvas
                ref={signatureRef}
                height={200}
                showControls={true}
                showSignerName={true}
                signerNameRequired={false}
                signerNameLabel="Nome do cliente"
                signerNamePlaceholder="Nome de quem está assinando"
                defaultSignerName={signerName}
                onDrawChange={setHasSignatureDrawn}
                onSave={(_, name) => { setSignerName(name); }}
              />
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
                <Button onClick={handleSignAndConfirm} disabled={!hasSignatureDrawn || isSubmitting}>
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