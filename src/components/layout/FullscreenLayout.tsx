import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Minimize2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FullscreenLayoutProps {
  children: ReactNode;
  backTo: string;
  title: string;
  fillHeight?: boolean;
}

export function FullscreenLayout({ children, backTo, title, fillHeight = false }: FullscreenLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card shrink-0 h-11">
        <h1 className="text-sm font-semibold text-foreground tracking-tight">{title}</h1>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground h-7"
          onClick={() => navigate(backTo)}
        >
          <Minimize2 className="h-3 w-3" />
          Sair
        </Button>
      </header>
      {fillHeight ? (
        <main className="flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      ) : (
        <main className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-[1360px] mx-auto py-6 px-6 lg:px-8">
            {children}
          </div>
        </main>
      )}
    </div>
  );
}
