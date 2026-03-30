import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText, User, Wrench, MessageSquare, ShieldAlert, ClipboardCheck } from "lucide-react";
import { ClientCombobox } from "@/components/services/ClientCombobox";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useToast } from "@/hooks/use-toast";
import {
  type TechnicalReportFormData,
  type TechnicalReport,
} from "@/hooks/useTechnicalReports";
import type { Client } from "@/hooks/useClients";
import { ReportEquipmentEditor, createBlankEquipment, type LocalReportEquipment } from "./ReportEquipmentEditor";
import type { ReportEquipment } from "@/hooks/useReportEquipment";

interface TechnicalReportFormProps {
  report?: TechnicalReport | null;
  clients: Client[];
  onSubmit: (data: TechnicalReportFormData, equipment: LocalReportEquipment[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultServiceId?: string | null;
  defaultQuoteServiceId?: string | null;
  defaultClientId?: string;
  existingEquipment?: ReportEquipment[];
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <CardHeader className="pb-3 pt-5 px-4">
      <CardTitle className="text-sm font-semibold flex items-center gap-2">
        <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        {title}
      </CardTitle>
    </CardHeader>
  );
}

export function TechnicalReportForm({
  report,
  clients,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultServiceId,
  defaultQuoteServiceId,
  defaultClientId,
  existingEquipment = [],
}: TechnicalReportFormProps) {
  const { toast } = useToast();
  const { fieldWorkers } = useTeamMembers();

  // Initialize equipment list from existing data or create blank
  const [equipmentList, setEquipmentList] = useState<LocalReportEquipment[]>(() => {
    if (existingEquipment.length > 0) {
      return existingEquipment.map((eq) => ({
        _localId: `db-${eq.id}`,
        _dbId: eq.id,
        equipment_number: eq.equipment_number,
        equipment_type: eq.equipment_type || "",
        equipment_brand: eq.equipment_brand || "",
        equipment_model: eq.equipment_model || "",
        capacity_btus: eq.capacity_btus || "",
        serial_number: eq.serial_number || "",
        equipment_location: eq.equipment_location || "",
        inspection_checklist: eq.inspection_checklist || [],
        condition_found: eq.condition_found || "",
        procedure_performed: eq.procedure_performed || "",
        technical_observations: eq.technical_observations || "",
        impact_level: eq.impact_level || "low",
        services_performed: eq.services_performed || "",
        equipment_condition: eq.equipment_condition || "",
        cleanliness_status: eq.cleanliness_status || "clean",
        equipment_working: eq.equipment_working || "yes",
        final_status: eq.final_status || "operational",
        measurements: eq.measurements || {},
      }));
    }
    // For legacy reports that have equipment data on the report itself
    if (report?.equipment_type || report?.equipment_brand) {
      return [{
        _localId: "legacy-1",
        equipment_number: 1,
        equipment_type: report.equipment_type || "",
        equipment_brand: report.equipment_brand || "",
        equipment_model: report.equipment_model || "",
        capacity_btus: report.capacity_btus || "",
        serial_number: report.serial_number || "",
        equipment_location: report.equipment_location || "",
        inspection_checklist: ((report.inspection_checklist as string[]) || []).map((key) => ({
          key,
          status: "ok" as const,
        })),
        condition_found: report.diagnosis || "",
        procedure_performed: report.interventions_performed || "",
        technical_observations: "",
        impact_level: report.equipment_working === "no" ? "high" : report.equipment_working === "partial" ? "medium" : "low",
        services_performed: "",
        equipment_condition: report.equipment_condition || "",
        cleanliness_status: report.cleanliness_status || "clean",
        equipment_working: report.equipment_working || "yes",
        final_status: report.equipment_working === "no" ? "non_operational" : report.equipment_working === "partial" ? "operational_with_caveats" : "operational",
        measurements: (report.measurements as Record<string, string>) || {},
      }];
    }
    return [createBlankEquipment(1)];
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TechnicalReportFormData>({
    defaultValues: {
      client_id: report?.client_id ?? defaultClientId ?? "",
      service_id: report?.service_id ?? defaultServiceId ?? null,
      quote_service_id: report?.quote_service_id ?? defaultQuoteServiceId ?? null,
      technician_id: report?.technician_id ?? "",
      report_date: report?.report_date
        ? new Date(report.report_date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      status: report?.status ?? "draft",
      visit_reason: report?.visit_reason ?? "",
      recommendation: report?.recommendation ?? "",
      risks: report?.risks ?? "",
      conclusion: report?.conclusion ?? "",
      observations: report?.observations ?? "",
      needs_quote: report?.needs_quote ?? false,
      responsible_technician_name:
        report?.responsible_technician_name ?? report?.technician_profile?.full_name ?? "",
    },
  });

  const selectedClientId = watch("client_id");

  const handleFormSubmit = async (data: TechnicalReportFormData) => {
    // Validate at least 1 equipment
    if (equipmentList.length === 0) {
      toast({ variant: "destructive", title: "Adicione ao menos 1 equipamento" });
      return;
    }

    // Validate each equipment has required fields
    for (let i = 0; i < equipmentList.length; i++) {
      const eq = equipmentList[i];
      if (!eq.condition_found || eq.condition_found.trim().length < 3) {
        toast({
          variant: "destructive",
          title: `Equipamento ${i + 1}: Preencha a condição encontrada`,
        });
        return;
      }
      if (!eq.procedure_performed || eq.procedure_performed.trim().length < 3) {
        toast({
          variant: "destructive",
          title: `Equipamento ${i + 1}: Preencha o procedimento realizado`,
        });
        return;
      }
    }

    // Derive overall status from worst equipment status
    const statuses = equipmentList.map((eq) => eq.final_status || "operational");
    let overallWorking = "yes";
    if (statuses.includes("non_operational")) overallWorking = "no";
    else if (statuses.includes("operational_with_caveats")) overallWorking = "partial";

    // Build conclusion if not provided
    const conclusion = data.conclusion || equipmentList.map((eq, i) => {
      const statusLabel = eq.final_status === "operational" ? "Operacional"
        : eq.final_status === "operational_with_caveats" ? "Operacional com ressalvas"
        : "Não operacional";
      return `Equipamento ${i + 1} (${eq.equipment_type || "—"}): ${statusLabel}`;
    }).join("\n");

    await onSubmit(
      {
        ...data,
        equipment_working: overallWorking,
        conclusion,
        // Keep legacy fields for backward compatibility
        equipment_type: equipmentList[0]?.equipment_type || null,
        equipment_brand: equipmentList[0]?.equipment_brand || null,
        equipment_model: equipmentList[0]?.equipment_model || null,
        equipment_quantity: equipmentList.length,
        diagnosis: equipmentList.map((eq, i) =>
          `[Equip. ${i + 1}] ${eq.condition_found || "—"}`
        ).join("\n\n"),
        interventions_performed: equipmentList.map((eq, i) =>
          `[Equip. ${i + 1}] ${eq.procedure_performed || "—"}`
        ).join("\n\n"),
      },
      equipmentList
    );
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-w-3xl mx-auto">
      {/* 1. Identification */}
      <Card>
        <SectionHeader icon={FileText} title="Identificação do Laudo" />
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Data do Laudo</Label>
              <Input type="date" {...register("report_date")} />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(v) => setValue("status", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="finalized">Finalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Técnico Responsável</Label>
            <Select
              value={watch("technician_id") || ""}
              onValueChange={(v) => {
                setValue("technician_id", v);
                const worker = fieldWorkers.find((w) => w.user_id === v);
                if (worker) setValue("responsible_technician_name", worker.full_name || "");
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o técnico" /></SelectTrigger>
              <SelectContent>
                {fieldWorkers.map((w) => (
                  <SelectItem key={w.user_id} value={w.user_id}>
                    {w.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 2. Client */}
      <Card>
        <SectionHeader icon={User} title="Dados do Cliente" />
        <CardContent className="px-4 pb-4">
          <ClientCombobox
            clients={clients}
            value={selectedClientId}
            onChange={(id) => setValue("client_id", id)}
          />
          {errors.client_id && (
            <p className="text-xs text-destructive mt-1">Selecione um cliente</p>
          )}
        </CardContent>
      </Card>

      {/* 3. Visit Reason */}
      <Card>
        <SectionHeader icon={ClipboardCheck} title="Motivo da Visita / Solicitação" />
        <CardContent className="px-4 pb-4">
          <Textarea
            rows={3}
            placeholder="Ex: Sem refrigeração, vazamento, ruído, manutenção preventiva..."
            {...register("visit_reason")}
          />
        </CardContent>
      </Card>

      {/* 4. MULTI-EQUIPMENT SECTION */}
      <ReportEquipmentEditor
        equipmentList={equipmentList}
        onChange={setEquipmentList}
      />

      {/* 5. Global Services */}
      <Card>
        <SectionHeader icon={Wrench} title="Serviços Gerais da OS" />
        <CardContent className="px-4 pb-4">
          <p className="text-[10px] text-muted-foreground mb-2">Serviços que não são específicos de um equipamento (ex: deslocamento, inspeção geral)</p>
          <Textarea
            rows={2}
            placeholder="Ex: Deslocamento técnico, inspeção geral do ambiente..."
            {...register("interventions_performed")}
          />
        </CardContent>
      </Card>

      {/* 6. Recommendation */}
      <Card>
        <SectionHeader icon={MessageSquare} title="Parecer e Recomendação" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={3} placeholder="Recomendações técnicas para o cliente..." {...register("recommendation")} />
        </CardContent>
      </Card>

      {/* 7. Risks */}
      <Card>
        <SectionHeader icon={ShieldAlert} title="Análise de Risco" />
        <CardContent className="px-4 pb-4">
          <p className="text-[10px] text-muted-foreground mb-2">O que acontece se o problema não for resolvido agora.</p>
          <Textarea rows={3} placeholder="Descreva os riscos..." {...register("risks")} />
        </CardContent>
      </Card>

      {/* 8. Needs Quote */}
      <Card>
        <CardContent className="px-4 py-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="needs_quote"
              checked={watch("needs_quote")}
              onCheckedChange={(v) => setValue("needs_quote", !!v)}
            />
            <Label htmlFor="needs_quote" className="cursor-pointer">Necessita orçamento adicional?</Label>
          </div>
        </CardContent>
      </Card>

      {/* 9. Observations */}
      <Card>
        <SectionHeader icon={MessageSquare} title="Observações Finais" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={3} {...register("observations")} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 pb-8">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {report ? "Salvar Alterações" : "Criar Laudo"}
        </Button>
      </div>
    </form>
  );
}
