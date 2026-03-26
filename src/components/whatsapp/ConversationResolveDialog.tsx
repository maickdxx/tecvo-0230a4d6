import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, SkipForward, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onResult: (result: "concluido" | "nao_convertido" | "skip" | null) => void;
  loading?: boolean;
}

export function ConversationResolveDialog({ open, onResult, loading }: Props) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !loading && onResult(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado da conversa</DialogTitle>
          <DialogDescription>
            Qual foi o resultado deste atendimento? Isso ajuda a acompanhar a taxa de conversão.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            className="justify-start gap-3 h-12 border-emerald-500/20 hover:bg-emerald-500/5 hover:border-emerald-500/40 dark:border-emerald-500/20 dark:hover:bg-emerald-500/10 disabled:opacity-50"
            onClick={() => onResult("concluido")}
            disabled={loading}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <div className="text-left">
              <p className="font-medium text-foreground">Venda realizada</p>
              <p className="text-[11px] text-muted-foreground">Cliente fechou negócio</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-12 border-rose-500/20 hover:bg-rose-500/5 hover:border-rose-500/40 dark:border-rose-500/20 dark:hover:bg-rose-500/10 disabled:opacity-50"
            onClick={() => onResult("nao_convertido")}
            disabled={loading}
          >
            <XCircle className="h-5 w-5 text-rose-500" />
            <div className="text-left">
              <p className="font-medium text-foreground">Não convertido</p>
              <p className="text-[11px] text-muted-foreground">Cliente não fechou</p>
            </div>
          </Button>
        </div>
        <DialogFooter className="flex sm:justify-between items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onResult("skip")}
            disabled={loading}
            className="text-muted-foreground hover:text-foreground"
          >
            <SkipForward className="h-4 w-4 mr-1" />
            Pular (Finalizar sem resultado)
          </Button>
          
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground animate-in fade-in duration-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Salvando...</span>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


