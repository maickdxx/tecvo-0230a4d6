import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";

interface EquipmentEditorProps {
  equipment: ServiceEquipmentLocal[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof ServiceEquipmentLocal, value: string) => void;
  disabled?: boolean;
}

function EquipmentCard({
  item,
  index,
  onRemove,
  onUpdate,
  disabled,
}: {
  item: ServiceEquipmentLocal;
  index: number;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: keyof ServiceEquipmentLocal, value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border rounded-xl bg-card shadow-sm transition-all hover:border-primary/20">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 rounded-t-xl">
            <span className="text-sm font-medium">
              Equipamento {index + 1}
              {item.name ? ` — ${item.name}` : ""}
            </span>
            <div className="flex items-center gap-1">
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Nome do equipamento</Label>
                <Input
                  placeholder="Ex: Condicionador de Ar 9.000 BTUs"
                  value={item.name}
                  onChange={(e) => onUpdate(item.id, "name", e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Marca</Label>
                <Input
                  placeholder="Ex: Springer Midea"
                  value={item.brand}
                  onChange={(e) => onUpdate(item.id, "brand", e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Modelo</Label>
                <Input
                  placeholder="Ex: Split Hi Wall"
                  value={item.model}
                  onChange={(e) => onUpdate(item.id, "model", e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Série</Label>
                <Input
                  placeholder="Nº de série"
                  value={item.serial_number}
                  onChange={(e) => onUpdate(item.id, "serial_number", e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-1">
              <Label className="text-xs">Condições</Label>
              <Textarea
                placeholder="Descreva as condições do equipamento no momento da visita..."
                rows={2}
                value={item.conditions}
                onChange={(e) => onUpdate(item.id, "conditions", e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Defects */}
            <div className="space-y-1">
              <Label className="text-xs">Defeitos</Label>
              <Textarea
                placeholder="Descreva os defeitos encontrados..."
                rows={2}
                value={item.defects}
                onChange={(e) => onUpdate(item.id, "defects", e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Solution */}
            <div className="space-y-1">
              <Label className="text-xs">Solução</Label>
              <Textarea
                placeholder="Descreva a solução aplicada..."
                rows={2}
                value={item.solution}
                onChange={(e) => onUpdate(item.id, "solution", e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Technical Report */}
            <div className="space-y-1">
              <Label className="text-xs">Laudo técnico</Label>
              <Textarea
                placeholder="Laudo técnico do equipamento..."
                rows={2}
                value={item.technical_report}
                onChange={(e) => onUpdate(item.id, "technical_report", e.target.value)}
                disabled={disabled}
              />
            </div>

            {/* Warranty Terms */}
            <div className="space-y-1">
              <Label className="text-xs">Termos de garantia</Label>
              <Textarea
                placeholder="Condições de garantia do serviço..."
                rows={2}
                value={item.warranty_terms}
                onChange={(e) => onUpdate(item.id, "warranty_terms", e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function EquipmentEditor({
  equipment,
  onAdd,
  onRemove,
  onUpdate,
  disabled = false,
}: EquipmentEditorProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Lista de Equipamentos</Label>
        {equipment.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {equipment.length} {equipment.length === 1 ? 'dispositivo' : 'dispositivos'}
          </span>
        )}
      </div>

      {equipment.map((item, index) => (
        <EquipmentCard
          key={item.id}
          item={item}
          index={index}
          onRemove={onRemove}
          onUpdate={onUpdate}
          disabled={disabled}
        />
      ))}

      {!disabled && (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 border-dashed py-6 hover:border-primary hover:text-primary transition-all"
          onClick={onAdd}
        >
          <Plus className="h-5 w-5" />
          Novo Equipamento / Dispositivo
        </Button>
      )}
    </div>
  );
}
