import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { PaymentMethod } from "@/hooks/usePaymentMethods";

interface PaymentMethodSelectProps {
  value: string;
  onChange: (slug: string) => void;
  disabled?: boolean;
  paymentMethods: PaymentMethod[];
  formatFee: (method: PaymentMethod) => string;
  showLabel?: boolean;
}

export function PaymentMethodSelect({
  value,
  onChange,
  disabled,
  paymentMethods,
  formatFee,
  showLabel = false,
}: PaymentMethodSelectProps) {
  // Separate regular methods from credit card installments
  const regularMethods = paymentMethods.filter((m) => m.installments === null);
  const creditCardMethods = paymentMethods
    .filter((m) => m.installments !== null)
    .sort((a, b) => (a.installments || 0) - (b.installments || 0));

  // Check if current value is a credit card method
  const isCreditCardSelected = value?.startsWith("credit_card_");
  
  // Get base payment type (for showing installment selector)
  const [showInstallments, setShowInstallments] = useState(isCreditCardSelected);
  const [selectedBaseType, setSelectedBaseType] = useState(
    isCreditCardSelected ? "credit_card" : value
  );

  // Sync showInstallments with value
  useEffect(() => {
    const isCC = value?.startsWith("credit_card_");
    setShowInstallments(isCC);
    if (isCC) {
      setSelectedBaseType("credit_card");
    } else if (value) {
      setSelectedBaseType(value);
    }
  }, [value]);

  const handleBaseTypeChange = (baseType: string) => {
    setSelectedBaseType(baseType);
    
    if (baseType === "credit_card") {
      // Show installment selector, default to 1x
      setShowInstallments(true);
      const firstInstallment = creditCardMethods.find((m) => m.installments === 1);
      if (firstInstallment) {
        onChange(firstInstallment.slug);
      }
    } else {
      // Regular payment method
      setShowInstallments(false);
      onChange(baseType);
    }
  };

  const handleInstallmentChange = (slug: string) => {
    onChange(slug);
  };

  // Avoid rendering Select with no items (causes React DOM removeChild error)
  const hasAnyMethods = regularMethods.length > 0 || creditCardMethods.length > 0;
  const currentValue = showInstallments ? "credit_card" : (selectedBaseType || undefined);

  return (
    <div className="space-y-2">
      {showLabel && <Label>Forma de Pagamento</Label>}
      <Select 
        value={currentValue} 
        onValueChange={handleBaseTypeChange} 
        disabled={disabled || !hasAnyMethods}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Nenhuma</SelectItem>
          {regularMethods.map((method) => (
            <SelectItem key={method.id} value={method.slug}>
              {method.name}
              {method.fee_value > 0 && (
                <span className="text-muted-foreground ml-2">
                  ({formatFee(method)})
                </span>
              )}
            </SelectItem>
          ))}
          {creditCardMethods.length > 0 && (
            <SelectItem value="credit_card">
              Cartão de Crédito
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      {/* Installment selector for credit card */}
      {showInstallments && creditCardMethods.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Parcelas</Label>
          <Select value={value} onValueChange={handleInstallmentChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione as parcelas..." />
            </SelectTrigger>
            <SelectContent>
              {creditCardMethods.map((method) => (
                <SelectItem key={method.id} value={method.slug}>
                  {method.installments}x
                  {method.fee_value > 0 && (
                    <span className="text-muted-foreground ml-2">
                      (Taxa: {method.fee_value}%)
                    </span>
                  )}
                  {method.fee_value === 0 && (
                    <span className="text-muted-foreground ml-2">
                      (sem juros)
                    </span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}