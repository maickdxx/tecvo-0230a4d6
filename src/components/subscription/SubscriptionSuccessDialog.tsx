import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PartyPopper, Zap, Star, Crown } from "lucide-react";
import { PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";

interface SubscriptionSuccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planSlug: string | null;
}

const ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-6 w-6 text-primary" />,
  essential: <Star className="h-6 w-6 text-primary" />,
  pro: <Crown className="h-6 w-6 text-primary" />,
};

export function SubscriptionSuccessDialog({
  open,
  onOpenChange,
  planSlug,
}: SubscriptionSuccessDialogProps) {
  const plan = planSlug && planSlug !== "free"
    ? PLAN_CONFIG[planSlug as Exclude<PlanSlug, "free">]
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
            <PartyPopper className="h-8 w-8" />
          </div>
          <DialogTitle className="text-2xl">
            Parabéns! 🎉
          </DialogTitle>
          <DialogDescription className="text-base">
            {plan
              ? `Seu plano ${plan.name} está ativo.`
              : "Sua assinatura foi ativada com sucesso!"}
          </DialogDescription>
        </DialogHeader>

        {plan && (
          <div className="flex items-center justify-center gap-2 py-2">
            {ICONS[planSlug!]}
            <span className="text-lg font-semibold text-foreground">
              {plan.name}
            </span>
            <span className="text-muted-foreground">—</span>
            <span className="font-medium text-foreground">{plan.price}{plan.period}</span>
          </div>
        )}

        <Button className="w-full mt-2" onClick={() => onOpenChange(false)}>
          Continuar para a plataforma
        </Button>
      </DialogContent>
    </Dialog>
  );
}
