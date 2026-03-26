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
import { useEffect } from "react";

interface Props {
  open: boolean;
  onResult: (result: "concluido" | "nao_convertido" | "skip" | null) => void;
  loading?: boolean;
}

export function ConversationResolveDialog({ open, onResult, loading }: Props) {
  // Handle ESC key manually if needed, but Dialog handles it.
  // We just need to make sure onOpenChange doesn't trigger onResult(null) if we want to distinguish "Cancel" from "Skip".
  
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
            className="justify-start gap-3 h-12 border-green-200 hover:bg-green-50 hover:border-green-400 dark:border-green-800 dark:hover:bg-green-950 disabled:opacity-50"
            onClick={() => onResult("concluido")}
            disabled={loading}
          >
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-foreground">Venda realizada</p>
              <p className="text-[11px] text-muted-foreground">Cliente fechou negócio</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-12 border-red-200 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:hover:bg-red-950 disabled:opacity-50"
            onClick={() => onResult("nao_convertido")}
            disabled={loading}
          >
            <XCircle className="h-5 w-5 text-red-500" />
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

