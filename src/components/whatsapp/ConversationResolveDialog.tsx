import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, SkipForward } from "lucide-react";

interface Props {
  open: boolean;
  onResult: (result: "concluido" | "nao_convertido" | null) => void;
}

export function ConversationResolveDialog({ open, onResult }: Props) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onResult(null)}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Resultado da conversa</AlertDialogTitle>
          <AlertDialogDescription>
            Qual foi o resultado deste atendimento? Isso ajuda a acompanhar a taxa de conversão.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            className="justify-start gap-3 h-12 border-green-200 hover:bg-green-50 hover:border-green-400 dark:border-green-800 dark:hover:bg-green-950"
            onClick={() => onResult("concluido")}
          >
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="text-left">
              <p className="font-medium text-foreground">Venda realizada</p>
              <p className="text-[11px] text-muted-foreground">Cliente fechou negócio</p>
            </div>
          </Button>
          <Button
            variant="outline"
            className="justify-start gap-3 h-12 border-red-200 hover:bg-red-50 hover:border-red-400 dark:border-red-800 dark:hover:bg-red-950"
            onClick={() => onResult("nao_convertido")}
          >
            <XCircle className="h-5 w-5 text-red-500" />
            <div className="text-left">
              <p className="font-medium text-foreground">Não convertido</p>
              <p className="text-[11px] text-muted-foreground">Cliente não fechou</p>
            </div>
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onResult(null)}>
            <SkipForward className="h-4 w-4 mr-1" />
            Pular
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
