import { Badge } from "@/components/ui/badge";
import { useFeedback } from "@/hooks/useFeedback";
import { Loader2 } from "lucide-react";

const statusConfig: Record<string, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
  em_analise: { label: "Em análise", className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  resolvido: { label: "Resolvido", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
};

const typeEmoji: Record<string, string> = {
  bug: "🐛",
  melhoria: "📈",
  sugestao: "💡",
};

export function FeedbackList() {
  const { feedbacks, isLoading } = useFeedback();

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!feedbacks || feedbacks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Você ainda não enviou nenhum feedback.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {feedbacks.map((fb) => {
        const status = statusConfig[fb.status] || statusConfig.pendente;
        return (
          <div key={fb.id} className="rounded-lg border border-border p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <span>{typeEmoji[fb.type] || "📝"}</span>
                {fb.title}
              </span>
              <Badge variant="outline" className={`${status.className} text-xs shrink-0`}>
                {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{fb.description}</p>
            <p className="text-xs text-muted-foreground/60">
              {new Date(fb.created_at).toLocaleDateString("pt-BR")}
            </p>
          </div>
        );
      })}
    </div>
  );
}
