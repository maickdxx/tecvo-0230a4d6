import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ChevronDown, ChevronUp, Wrench, Loader2, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { EquipmentChecklistEditor } from "./EquipmentChecklistEditor";
import {
  EQUIPMENT_TYPES,
  IMPACT_LEVELS,
  FINAL_STATUS_OPTIONS,
  type ReportEquipmentFormData,
  type ChecklistItemStatus,
} from "@/hooks/useReportEquipment";
import {
  EQUIPMENT_CONDITIONS,
  CLEANLINESS_STATUS,
} from "@/hooks/useTechnicalReports";

export interface LocalReportEquipment extends ReportEquipmentFormData {
  _localId: string;
  _dbId?: string;
}

interface ReportEquipmentEditorProps {
  equipmentList: LocalReportEquipment[];
  onChange: (list: LocalReportEquipment[]) => void;
}

function generateLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createBlankEquipment(number: number): LocalReportEquipment {
  return {
    _localId: generateLocalId(),
    equipment_number: number,
    equipment_type: "",
    equipment_brand: "",
    equipment_model: "",
    capacity_btus: "",
    serial_number: "",
    equipment_location: "",
    inspection_checklist: [],
    condition_found: "",
    procedure_performed: "",
    technical_observations: "",
    impact_level: "low",
    services_performed: "",
    equipment_condition: "",
    cleanliness_status: "clean",
    equipment_working: "yes",
    final_status: "operational",
    measurements: {},
  };
}

function EquipmentBlock({
  eq,
  index,
  onUpdate,
  onRemove,
  canRemove,
}: {
  eq: LocalReportEquipment;
  index: number;
  onUpdate: (updated: LocalReportEquipment) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(true);

  const update = (partial: Partial<LocalReportEquipment>) => {
    onUpdate({ ...eq, ...partial });
  };

  const updateMeasurement = (key: string, value: string) => {
    update({ measurements: { ...eq.measurements, [key]: value } });
  };

  const finalStatusColor = eq.final_status === "operational"
    ? "bg-green-500/15 text-green-700 border-green-200"
    : eq.final_status === "operational_with_caveats"
    ? "bg-amber-500/15 text-amber-700 border-amber-200"
    : "bg-red-500/15 text-red-700 border-red-200";

  return (
    <Card className="border-primary/20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 pt-3 px-4 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
                  <Wrench className="h-3.5 w-3.5 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">
                  Equipamento {index + 1}
                  {eq.equipment_type && (
                    <span className="ml-2 font-normal text-muted-foreground">— {eq.equipment_type}</span>
                  )}
                </CardTitle>
                {eq.final_status && (
                  <Badge className={cn("text-[10px] border ml-2", finalStatusColor)}>
                    {FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {canRemove && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="px-4 pb-4 space-y-5">
            {/* Identification */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Identificação</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={eq.equipment_type || ""} onValueChange={(v) => update({ equipment_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Localização</Label>
                  <Input
                    placeholder="Ex: sala, quarto, recepção"
                    value={eq.equipment_location || ""}
                    onChange={(e) => update({ equipment_location: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Marca (opcional)</Label>
                  <Input
                    value={eq.equipment_brand || ""}
                    onChange={(e) => update({ equipment_brand: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Modelo (opcional)</Label>
                  <Input
                    value={eq.equipment_model || ""}
                    onChange={(e) => update({ equipment_model: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Capacidade (BTUs)</Label>
                  <Input
                    placeholder="Ex: 12000"
                    value={eq.capacity_btus || ""}
                    onChange={(e) => update({ capacity_btus: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Nº de Série</Label>
                  <Input
                    value={eq.serial_number || ""}
                    onChange={(e) => update({ serial_number: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Checklist Técnico</p>
              <EquipmentChecklistEditor
                checklist={eq.inspection_checklist || []}
                onChange={(cl) => update({ inspection_checklist: cl })}
              />
            </div>

            {/* Measurements */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Medições</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { key: "pressure", label: "Pressão", unit: "psi" },
                  { key: "temperature", label: "Temperatura", unit: "°C" },
                  { key: "voltage_measured", label: "Tensão", unit: "V" },
                  { key: "current_measured", label: "Corrente", unit: "A" },
                ].map((m) => (
                  <div key={m.key}>
                    <Label className="text-xs">{m.label} ({m.unit})</Label>
                    <Input
                      value={eq.measurements?.[m.key] || ""}
                      onChange={(e) => updateMeasurement(m.key, e.target.value)}
                      placeholder={m.unit}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Structured Diagnosis */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Diagnóstico Técnico</p>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Condição encontrada *</Label>
                  <Textarea
                    rows={2}
                    placeholder="Descreva a condição encontrada no equipamento..."
                    value={eq.condition_found || ""}
                    onChange={(e) => update({ condition_found: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Procedimento realizado *</Label>
                  <Textarea
                    rows={2}
                    placeholder="Descreva o procedimento técnico realizado..."
                    value={eq.procedure_performed || ""}
                    onChange={(e) => update({ procedure_performed: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Observações técnicas (opcional)</Label>
                  <Textarea
                    rows={2}
                    placeholder="Informações complementares..."
                    value={eq.technical_observations || ""}
                    onChange={(e) => update({ technical_observations: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Impact Level */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Impacto Técnico</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.entries(IMPACT_LEVELS).map(([key, { label, description }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ impact_level: key })}
                    className={cn(
                      "flex flex-col items-start p-3 rounded-lg border text-left transition-all",
                      eq.impact_level === key
                        ? key === "low"
                          ? "bg-green-500/15 border-green-300"
                          : key === "medium"
                          ? "bg-amber-500/15 border-amber-300"
                          : "bg-red-500/15 border-red-300"
                        : "bg-muted/30 border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">{description}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Services Performed */}
            <div>
              <Label className="text-xs">Serviços executados neste equipamento</Label>
              <Textarea
                rows={2}
                placeholder="Ex: Limpeza de filtros, higienização de serpentina..."
                value={eq.services_performed || ""}
                onChange={(e) => update({ services_performed: e.target.value })}
              />
            </div>

            {/* Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status do Equipamento</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Condição Estrutural</Label>
                  <Select value={eq.equipment_condition || ""} onValueChange={(v) => update({ equipment_condition: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EQUIPMENT_CONDITIONS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Condição de Limpeza</Label>
                  <Select value={eq.cleanliness_status || "clean"} onValueChange={(v) => update({ cleanliness_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CLEANLINESS_STATUS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Funcionando?</Label>
                  <Select value={eq.equipment_working || "yes"} onValueChange={(v) => update({ equipment_working: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Sim</SelectItem>
                      <SelectItem value="no">Não</SelectItem>
                      <SelectItem value="partial">Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Final Status */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status Final</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {Object.entries(FINAL_STATUS_OPTIONS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => update({ final_status: key })}
                    className={cn(
                      "px-3 py-2.5 rounded-lg border text-sm font-medium transition-all",
                      eq.final_status === key
                        ? key === "operational"
                          ? "bg-green-500/15 border-green-300 text-green-700"
                          : key === "operational_with_caveats"
                          ? "bg-amber-500/15 border-amber-300 text-amber-700"
                          : "bg-red-500/15 border-red-300 text-red-700"
                        : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function ReportEquipmentEditor({ equipmentList, onChange }: ReportEquipmentEditorProps) {
  const addEquipment = () => {
    const newEq = createBlankEquipment(equipmentList.length + 1);
    onChange([...equipmentList, newEq]);
  };

  const updateEquipment = (localId: string, updated: LocalReportEquipment) => {
    onChange(equipmentList.map((eq) => (eq._localId === localId ? updated : eq)));
  };

  const removeEquipment = (localId: string) => {
    const filtered = equipmentList.filter((eq) => eq._localId !== localId);
    // Re-number
    onChange(filtered.map((eq, i) => ({ ...eq, equipment_number: i + 1 })));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
            <Wrench className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold">Equipamentos ({equipmentList.length})</h3>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addEquipment} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar Equipamento
        </Button>
      </div>

      {equipmentList.length === 0 && (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <Wrench className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum equipamento adicionado</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 gap-1.5" onClick={addEquipment}>
            <Plus className="h-3.5 w-3.5" /> Adicionar Primeiro Equipamento
          </Button>
        </div>
      )}

      {equipmentList.map((eq, index) => (
        <EquipmentBlock
          key={eq._localId}
          eq={eq}
          index={index}
          onUpdate={(updated) => updateEquipment(eq._localId, updated)}
          onRemove={() => removeEquipment(eq._localId)}
          canRemove={equipmentList.length > 1}
        />
      ))}
    </div>
  );
}

export { createBlankEquipment, generateLocalId };
