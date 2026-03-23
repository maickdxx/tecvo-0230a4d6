import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AccountForm } from "./AccountForm";
import type { Account, AccountFormData, AccountType } from "@/hooks/useAccounts";

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account | null;
  accountType: AccountType;
  onSubmit: (data: AccountFormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function AccountDialog({
  open,
  onOpenChange,
  account,
  accountType,
  onSubmit,
  isSubmitting,
}: AccountDialogProps) {
  const handleSubmit = async (data: AccountFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  const title = account 
    ? "Editar Conta"
    : accountType === "payable" 
      ? "Nova Conta a Pagar"
      : "Nova Conta a Receber";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <AccountForm
          account={account}
          accountType={accountType}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
}
