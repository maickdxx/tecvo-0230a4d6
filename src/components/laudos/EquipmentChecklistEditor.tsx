import { cn } from "@/lib/utils";
import { CHECKLIST_ITEMS, type ChecklistItemStatus } from "@/hooks/useReportEquipment";

interface EquipmentChecklistEditorProps {
  checklist: ChecklistItemStatus[];
  onChange: (checklist: ChecklistItemStatus[]) => void;
}

const STATUS_COLORS = {
  ok: "bg-green-500/15 text-green-700 border-green-300 hover:bg-green-500/25",
  attention: "bg-amber-500/15 text-amber-700 border-amber-300 hover:bg-amber-500/25",
  critical: "bg-red-500/15 text-red-700 border-red-300 hover:bg-red-500/25",
};

const STATUS_LABELS = { ok: "OK", attention: "Atenção", critical: "Crítico" };

export function EquipmentChecklistEditor({ checklist, onChange }: EquipmentChecklistEditorProps) {
  const getStatus = (key: string) => {
    return checklist.find((i) => i.key === key)?.status || null;
  };

  const cycleStatus = (key: string) => {
    const current = getStatus(key);
    const next: "ok" | "attention" | "critical" | null =
      current === null ? "ok" : current === "ok" ? "attention" : current === "attention" ? "critical" : null;

    if (next === null) {
      onChange(checklist.filter((i) => i.key !== key));
    } else {
      const exists = checklist.find((i) => i.key === key);
      if (exists) {
        onChange(checklist.map((i) => (i.key === key ? { ...i, status: next } : i)));
      } else {
        onChange([...checklist, { key, status: next }]);
      }
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground mb-2">
        Clique para alternar: <span className="font-medium">sem status → OK → Atenção → Crítico → sem status</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {CHECKLIST_ITEMS.map((item) => {
          const status = getStatus(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => cycleStatus(item.key)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left",
                status ? STATUS_COLORS[status] : "bg-muted/30 text-muted-foreground border-border hover:bg-muted/50"
              )}
            >
              <span className="font-medium">{item.label}</span>
              {status && (
                <span className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                  status === "ok" && "bg-green-600 text-white",
                  status === "attention" && "bg-amber-500 text-white",
                  status === "critical" && "bg-red-600 text-white",
                )}>
                  {STATUS_LABELS[status]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
