import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TransactionForm } from "./TransactionForm";
import type { Transaction, TransactionFormData, TransactionType } from "@/hooks/useTransactions";

interface TransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  defaultType?: TransactionType;
  defaultCategory?: string;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function TransactionDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "income",
  defaultCategory,
  onSubmit,
  isSubmitting,
}: TransactionDialogProps) {
  const handleSubmit = async (data: TransactionFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar Transação" : defaultType === "income" ? "Nova Entrada" : "Nova Saída"}
          </DialogTitle>
        </DialogHeader>
        <TransactionForm
          transaction={transaction}
          defaultType={defaultType}
          defaultCategory={defaultCategory}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
