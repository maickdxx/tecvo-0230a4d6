import { useState, useEffect } from "react";
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
import { Loader2, FileText, User, Wrench, ClipboardCheck, Stethoscope, Gauge, ShieldAlert, MessageSquare } from "lucide-react";
import { ClientCombobox } from "@/components/services/ClientCombobox";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useToast } from "@/hooks/use-toast";
import {
  INSPECTION_ITEMS,
  EQUIPMENT_CONDITIONS,
  CLEANLINESS_STATUS,
  type TechnicalReportFormData,
  type TechnicalReport,
} from "@/hooks/useTechnicalReports";
import type { Client } from "@/hooks/useClients";

interface TechnicalReportFormProps {
  report?: TechnicalReport | null;
  clients: Client[];
  onSubmit: (data: TechnicalReportFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultServiceId?: string | null;
  defaultQuoteServiceId?: string | null;
  defaultClientId?: string;
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
}: TechnicalReportFormProps) {
  const { toast } = useToast();
  const { fieldWorkers } = useTeamMembers();
  const [checklist, setChecklist] = useState<string[]>(
    (report?.inspection_checklist as string[]) || []
  );
  const [measurements, setMeasurements] = useState<Record<string, string>>(
    (report?.measurements as Record<string, string>) || {}
  );

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
      equipment_type: report?.equipment_type ?? "",
      equipment_brand: report?.equipment_brand ?? "",
      equipment_model: report?.equipment_model ?? "",
      capacity_btus: report?.capacity_btus ?? "",
      serial_number: report?.serial_number ?? "",
      equipment_quantity: report?.equipment_quantity ?? 1,
      equipment_location: report?.equipment_location ?? "",
      visit_reason: report?.visit_reason ?? "",
      diagnosis: report?.diagnosis ?? "",
      equipment_condition: report?.equipment_condition ?? "",
      cleanliness_status: report?.cleanliness_status ?? "clean",
      recommendation: report?.recommendation ?? "Realizar reaperto e alinhamento da turbina e manter plano de manutenção preventiva periódica.",
      risks: report?.risks ?? "",
      interventions_performed: report?.interventions_performed ?? "",
      conclusion: report?.conclusion ?? "Após a execução da limpeza química da evaporadora e higienização dos filtros, houve melhora no fluxo de ar e nas condições de operação do equipamento.\n\nNo entanto, ainda foi identificado leve ruído intermitente associado ao conjunto da turbina, indicando início de desgaste mecânico, o que pode impactar a performance ao longo do tempo.\n\nSTATUS ATUAL:\nEquipamento operacional com desempenho parcialmente restabelecido, porém ainda requer atenção para ajuste mecânico futuro.",
      observations: report?.observations ?? "",
      needs_quote: report?.needs_quote ?? false,
      equipment_working: report?.equipment_working ?? "yes",
      responsible_technician_name:
        report?.responsible_technician_name ?? report?.technician_profile?.full_name ?? "",
    },
  });

  const selectedClientId = watch("client_id");

  const toggleChecklistItem = (key: string) => {
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const updateMeasurement = (key: string, value: string) => {
    setMeasurements((prev) => ({ ...prev, [key]: value }));
  };

  const handleFormSubmit = async (data: TechnicalReportFormData) => {
    // Validação de consistência
    if (data.equipment_condition === "good" && data.cleanliness_status === "dirty" && !data.observations) {
      toast({
        variant: "destructive",
        title: "Inconsistência técnica",
        description: "Equipamento em 'Perfeito estado' mas marcado como 'Sujo'. Por favor, adicione contexto nas observações.",
      });
      return;
    }

    if (!data.diagnosis || data.diagnosis.length < 10) {
      toast({
        variant: "destructive",
        title: "Diagnóstico incompleto",
        description: "O diagnóstico técnico deve ser mais detalhado para validade jurídica.",
      });
      return;
    }

    if (!data.conclusion || data.conclusion.length < 10) {
      toast({
        variant: "destructive",
        title: "Conclusão obrigatória",
        description: "A conclusão técnica é obrigatória e deve informar o status final.",
      });
      return;
    }

    await onSubmit({
      ...data,
      inspection_checklist: checklist,
      measurements,
    });
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

      {/* 3. Equipment */}
      <Card>
        <SectionHeader icon={Wrench} title="Identificação do Equipamento" />
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Equipamento</Label>
              <Input placeholder="Ex: Split, Cassete, Piso Teto" {...register("equipment_type")} />
            </div>
            <div>
              <Label>Marca</Label>
              <Input {...register("equipment_brand")} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input {...register("equipment_model")} />
            </div>
            <div>
              <Label>Capacidade (BTUs)</Label>
              <Input placeholder="Ex: 12000" {...register("capacity_btus")} />
            </div>
            <div>
              <Label>Nº de Série</Label>
              <Input {...register("serial_number")} />
            </div>
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} {...register("equipment_quantity", { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <Label>Localização do Equipamento</Label>
            <Input placeholder="Ex: Sala principal, 2º andar" {...register("equipment_location")} />
          </div>
        </CardContent>
      </Card>

      {/* 4. Visit Reason */}
      <Card>
        <SectionHeader icon={Stethoscope} title="Motivo da Visita / Solicitação" />
        <CardContent className="px-4 pb-4">
          <Textarea
            rows={3}
            placeholder="Ex: Sem refrigeração, vazamento, ruído, manutenção preventiva..."
            {...register("visit_reason")}
          />
        </CardContent>
      </Card>

      {/* 5. Inspection Checklist */}
      <Card>
        <SectionHeader icon={ClipboardCheck} title="Inspeção Realizada" />
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {INSPECTION_ITEMS.map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer py-1">
                <Checkbox
                  checked={checklist.includes(item.key)}
                  onCheckedChange={() => toggleChecklistItem(item.key)}
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 6. Diagnosis */}
      <Card>
        <SectionHeader icon={Stethoscope} title="Diagnóstico Técnico" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={4} placeholder="Descreva o diagnóstico detalhado..." {...register("diagnosis")} />
        </CardContent>
      </Card>

      {/* 7. Measurements */}
      <Card>
        <SectionHeader icon={Gauge} title="Evidências / Medições Técnicas" />
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "pressure", label: "Pressão", unit: "psi" },
              { key: "temperature", label: "Temperatura", unit: "°C" },
              { key: "voltage_measured", label: "Tensão", unit: "V" },
              { key: "current_measured", label: "Corrente", unit: "A" },
            ].map((m) => (
              <div key={m.key}>
                <Label>{m.label} ({m.unit})</Label>
                <div className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    value={measurements[m.key] || ""}
                    onChange={(e) => updateMeasurement(m.key, e.target.value)}
                    placeholder={`Ex: ${m.key === "pressure" ? "65" : m.key === "temperature" ? "12" : m.key === "voltage" ? "220" : "4.5"}`}
                  />
                  <span className="text-xs font-semibold text-muted-foreground w-8">{m.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Label>Observações adicionais das medições</Label>
            <Textarea
              rows={2}
              value={measurements.notes || ""}
              onChange={(e) => updateMeasurement("notes", e.target.value)}
              placeholder="Contextualize os valores aferidos se necessário..."
            />
          </div>
        </CardContent>
      </Card>

      {/* 8. Equipment Condition */}
      <Card>
        <SectionHeader icon={ShieldAlert} title="Status Estrutural e Limpeza" />
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Condição Estrutural</Label>
              <Select
                value={watch("equipment_condition") || ""}
                onValueChange={(v) => setValue("equipment_condition", v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EQUIPMENT_CONDITIONS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condição de Limpeza</Label>
              <Select
                value={watch("cleanliness_status") || "clean"}
                onValueChange={(v) => setValue("cleanliness_status", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CLEANLINESS_STATUS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipamento funcionando?</Label>
              <Select
                value={watch("equipment_working") || "yes"}
                onValueChange={(v) => setValue("equipment_working", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Sim</SelectItem>
                  <SelectItem value="no">Não</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-1.5">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="needs_quote"
                  checked={watch("needs_quote")}
                  onCheckedChange={(v) => setValue("needs_quote", !!v)}
                />
                <Label htmlFor="needs_quote" className="cursor-pointer">Necessita orçamento?</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 9. Interventions */}
      <Card>
        <SectionHeader icon={Wrench} title="Intervenções Realizadas" />
        <CardContent className="px-4 pb-4">
          <Textarea 
            rows={3} 
            placeholder="O que foi feito nesta visita? Ex: Limpeza de filtros, reaperto de conexões..." 
            {...register("interventions_performed")} 
          />
        </CardContent>
      </Card>

      {/* 10. Recommendation */}
      <Card>
        <SectionHeader icon={MessageSquare} title="Recomendações de Segurança / Ação" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={3} placeholder="Recomendações técnicas para o cliente..." {...register("recommendation")} />
        </CardContent>
      </Card>

      {/* 10. Risks */}
      <Card>
        <SectionHeader icon={ShieldAlert} title="Riscos / Consequências" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={3} placeholder="Descreva os riscos caso não seja corrigido..." {...register("risks")} />
        </CardContent>
      </Card>

      {/* 11. Conclusion */}
      <Card>
        <SectionHeader icon={FileText} title="CONCLUSÃO TÉCNICA APÓS INTERVENÇÃO" />
        <CardContent className="px-4 pb-4">
          <Textarea rows={3} {...register("conclusion")} placeholder="Descreva a conclusão técnica após a intervenção..." />
        </CardContent>
      </Card>

      {/* 12. Observations */}
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
