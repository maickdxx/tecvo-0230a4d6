import { useState, useEffect } from "react";
import { Settings, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useDashboardLayout,
  WIDGET_LABELS,
  type DashboardWidget,
} from "@/hooks/useDashboardLayout";

export function DashboardCustomizeDialog() {
  const { layout, saveLayout, resetLayout, saving } = useDashboardLayout();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DashboardWidget[]>([]);

  useEffect(() => {
    if (open) setItems([...layout]);
  }, [open, layout]);

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w))
    );
  };

  const move = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const copy = [...prev];
      [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
      return copy;
    });
  };

  const handleSave = async () => {
    await saveLayout(items);
    setOpen(false);
  };

  const handleReset = async () => {
    await resetLayout();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar Visão Geral</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-1">
            {items.map((widget, idx) => (
              <div
                key={widget.id}
                className="flex items-center gap-2 rounded-lg border p-2.5"
              >
                <Switch
                  checked={widget.visible}
                  onCheckedChange={() => toggle(widget.id)}
                />
                <span className="flex-1 text-sm min-w-0 truncate">
                  {WIDGET_LABELS[widget.id] ?? widget.id}
                </span>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={idx === 0}
                    onClick={() => move(widget.id, -1)}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={idx === items.length - 1}
                    onClick={() => move(widget.id, 1)}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
