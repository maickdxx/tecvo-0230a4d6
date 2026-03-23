import { Download, X } from "lucide-react";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { Button } from "@/components/ui/button";

export function InstallBanner() {
  const { showBanner, promptInstall, dismiss } = useInstallPrompt();

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Instalar Tecvo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acesse como app direto do seu computador, sem precisar do navegador.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" className="h-8 text-xs gap-1.5" onClick={promptInstall}>
                <Download className="h-3.5 w-3.5" />
                Instalar
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={dismiss}>
                Agora não
              </Button>
            </div>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-md p-1 text-muted-foreground/60 hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
