import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle,
  Wrench,
  Camera,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { ReportPhotoUploader } from "@/components/laudos/ReportPhotoUploader";
import { useReportPhotos } from "@/hooks/useReportPhotos";
import type {
  EquipmentReportData,
  ServiceEquipmentWithReport,
} from "@/hooks/useServiceExecutionMode";

interface EquipmentReportFormProps {
  equipment: ServiceEquipmentWithReport;
  reportId: string | null;
  onBack: () => void;
  onAutoSave: (equipmentId: string, data: Partial<EquipmentReportData>) => void;
  onSave: (equipmentId: string, data: Partial<EquipmentReportData>) => Promise<void>;
  onComplete: (equipmentId: string) => Promise<void>;
}

const SERVICE_TYPES = [
  { value: "limpeza", label: "Limpeza" },
  { value: "manutencao_preventiva", label: "Manutenção Preventiva" },
  { value: "manutencao_corretiva", label: "Manutenção Corretiva" },
  { value: "instalacao", label: "Instalação" },
  { value: "diagnostico", label: "Diagnóstico" },
  { value: "pmoc", label: "PMOC" },
  { value: "desinstalacao", label: "Desinstalação" },
  { value: "outro", label: "Outro" },
];

const CHECKLIST_BY_TYPE: Record<string, { key: string; label: string }[]> = {
  limpeza: [
    { key: "filtro_limpo", label: "Filtro limpo" },
    { key: "serpentina_limpa", label: "Serpentina limpa" },
    { key: "dreno_desobstruido", label: "Dreno desobstruído" },
    { key: "bandeja_limpa", label: "Bandeja limpa" },
    { key: "ventilador_limpo", label: "Ventilador/turbina limpo" },
    { key: "gabinete_limpo", label: "Gabinete limpo" },
    { key: "teste_funcionamento", label: "Teste de funcionamento OK" },
  ],
  manutencao_preventiva: [
    { key: "filtro_verificado", label: "Filtro verificado" },
    { key: "serpentina_verificada", label: "Serpentina verificada" },
    { key: "dreno_verificado", label: "Dreno verificado" },
    { key: "pressao_gas", label: "Pressão do gás verificada" },
    { key: "tensao_corrente", label: "Tensão e corrente OK" },
    { key: "capacitor_ok", label: "Capacitor verificado" },
    { key: "temp_saida", label: "Temperatura de saída medida" },
    { key: "isolamento_ok", label: "Isolamento verificado" },
  ],
  manutencao_corretiva: [
    { key: "defeito_identificado", label: "Defeito identificado" },
    { key: "peca_substituida", label: "Peça substituída" },
    { key: "teste_pos_reparo", label: "Teste pós-reparo OK" },
    { key: "tensao_corrente", label: "Tensão e corrente OK" },
    { key: "temp_saida", label: "Temperatura de saída medida" },
  ],
  instalacao: [
    { key: "local_preparado", label: "Local preparado" },
    { key: "suportes_fixados", label: "Suportes fixados" },
    { key: "tubulacao_conectada", label: "Tubulação conectada" },
    { key: "vacuo_realizado", label: "Vácuo realizado" },
    { key: "carga_gas", label: "Carga de gás OK" },
    { key: "eletrica_conectada", label: "Elétrica conectada" },
    { key: "teste_final", label: "Teste final OK" },
    { key: "cliente_orientado", label: "Cliente orientado sobre uso" },
  ],
  pmoc: [
    { key: "filtro_limpo", label: "Filtro limpo" },
    { key: "serpentina_limpa", label: "Serpentina limpa" },
    { key: "dreno_verificado", label: "Dreno verificado" },
    { key: "eletrica_verificada", label: "Parte elétrica verificada" },
    { key: "pressao_gas", label: "Pressão do gás verificada" },
    { key: "temp_saida", label: "Temperatura de saída medida" },
    { key: "bandeja_limpa", label: "Bandeja limpa" },
    { key: "ruido_vibracao", label: "Ruído/vibração verificado" },
  ],
  diagnostico: [
    { key: "inspecao_visual", label: "Inspeção visual realizada" },
    { key: "medicoes_eletricas", label: "Medições elétricas feitas" },
    { key: "teste_componentes", label: "Componentes testados" },
    { key: "vazamento_verificado", label: "Vazamento verificado" },
  ],
};

const DEFAULT_CHECKLIST = [
  { key: "inspecao_geral", label: "Inspeção geral" },
  { key: "teste_funcionamento", label: "Teste de funcionamento" },
  { key: "limpeza_basica", label: "Limpeza básica" },
];

// Service types that require before/after photos
const PHOTO_REQUIRED_TYPES = ["limpeza", "pmoc"];

export function EquipmentReportForm({
  equipment,
  reportId,
  onBack,
  onAutoSave,
  onSave,
  onComplete,
}: EquipmentReportFormProps) {
  const rd = equipment.reportData;
  const [serviceType, setServiceType] = useState(rd?.service_type_performed || "");
  const [problem, setProblem] = useState(rd?.problem_identified || "");
  const [workPerformed, setWorkPerformed] = useState(rd?.work_performed || "");
  const [observations, setObservations] = useState(rd?.observations || "");
  const [checklist, setChecklist] = useState<string[]>(rd?.checklist || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const { photos } = useReportPhotos(reportId || undefined, equipment.id);

  const isCompleted = rd?.status === "completed";

  const requiresPhotos = PHOTO_REQUIRED_TYPES.includes(serviceType);

  // Validation function
  const validate = useCallback((): string[] => {
    const errors: string[] = [];
    if (!serviceType) errors.push("Selecione o tipo de serviço");
    if (!problem.trim()) errors.push("Preencha o problema identificado");
    if (!workPerformed.trim()) errors.push("Preencha o que foi feito");

    if (requiresPhotos) {
      const hasBefore = photos.some((p) => p.category === "before");
      const hasAfter = photos.some((p) => p.category === "after");
      if (!hasBefore) errors.push("Adicione pelo menos 1 foto \"Antes\"");
      if (!hasAfter) errors.push("Adicione pelo menos 1 foto \"Depois\"");
    }

    return errors;
  }, [serviceType, problem, workPerformed, requiresPhotos, photos]);

  // Auto-save on changes
  const triggerAutoSave = useCallback(
    (overrides?: Partial<EquipmentReportData>) => {
      const data: Partial<EquipmentReportData> = {
        service_type_performed: serviceType || null,
        problem_identified: problem || null,
        work_performed: workPerformed || null,
        observations: observations || null,
        checklist,
        status: "in_progress",
        ...overrides,
      };
      onAutoSave(equipment.id, data);
    },
    [serviceType, problem, workPerformed, observations, checklist, equipment.id, onAutoSave]
  );

  useEffect(() => {
    if (isCompleted) return;
    const hasData = serviceType || problem || workPerformed || observations || checklist.length > 0;
    if (hasData) triggerAutoSave();
  }, [serviceType, problem, workPerformed, observations, checklist]);

  // Clear validation errors when fields change
  useEffect(() => {
    if (validationErrors.length > 0) setValidationErrors([]);
  }, [serviceType, problem, workPerformed, photos.length]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(equipment.id, {
        service_type_performed: serviceType || null,
        problem_identified: problem || null,
        work_performed: workPerformed || null,
        observations: observations || null,
        checklist,
        status: "in_progress",
      });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleComplete = async () => {
    const errors = validate();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);
    setIsCompleting(true);
    try {
      await onSave(equipment.id, {
        service_type_performed: serviceType || null,
        problem_identified: problem || null,
        work_performed: workPerformed || null,
        observations: observations || null,
        checklist,
        status: "completed",
      });
      await onComplete(equipment.id);
    } finally {
      setIsCompleting(false);
    }
  };

  const toggleChecklist = (key: string) => {
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const checklistItems = serviceType
    ? CHECKLIST_BY_TYPE[serviceType] || DEFAULT_CHECKLIST
    : DEFAULT_CHECKLIST;

  // Reset checklist when service type changes
  const handleServiceTypeChange = (value: string) => {
    setServiceType(value);
    setChecklist([]);
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold truncate">{equipment.name || "Equipamento"}</h2>
          <p className="text-xs text-muted-foreground">
            {[equipment.brand, equipment.model].filter(Boolean).join(" — ") || "Sem detalhes"}
          </p>
        </div>
        {isCompleted && (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
            <CheckCircle className="h-3 w-3 mr-1" /> Concluído
          </Badge>
        )}
      </div>

      {/* Service type */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wrench className="h-4 w-4 text-primary" />
            <Label className="font-semibold text-sm">Tipo de Serviço *</Label>
          </div>
          <Select value={serviceType} onValueChange={handleServiceTypeChange} disabled={isCompleted}>
            <SelectTrigger className={!serviceType && validationErrors.length > 0 ? "border-destructive" : ""}>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Dynamic checklist */}
      {checklistItems.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="font-semibold text-sm">Checklist</Label>
            <div className="space-y-1.5">
              {checklistItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={checklist.includes(item.key)}
                    onCheckedChange={() => toggleChecklist(item.key)}
                    disabled={isCompleted}
                  />
                  <span className="text-sm">{item.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Problem identified */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="font-semibold text-sm">Problema Identificado *</Label>
          <Textarea
            rows={3}
            placeholder="Descreva o problema encontrado..."
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            disabled={isCompleted}
            className={!problem.trim() && validationErrors.length > 0 ? "border-destructive" : ""}
          />
        </CardContent>
      </Card>

      {/* Work performed */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="font-semibold text-sm">O que foi feito *</Label>
          <Textarea
            rows={3}
            placeholder="Descreva os serviços realizados..."
            value={workPerformed}
            onChange={(e) => setWorkPerformed(e.target.value)}
            disabled={isCompleted}
            className={!workPerformed.trim() && validationErrors.length > 0 ? "border-destructive" : ""}
          />
        </CardContent>
      </Card>

      {/* Photos */}
      {reportId && (
        <Card className={requiresPhotos && validationErrors.some(e => e.includes("foto")) ? "border-destructive" : ""}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Camera className="h-4 w-4 text-primary" />
              <Label className="font-semibold text-sm">Fotos</Label>
              {requiresPhotos && (
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400">
                  Antes/Depois obrigatório
                </Badge>
              )}
            </div>
            <ReportPhotoUploader
              reportId={reportId}
              equipmentId={equipment.id}
            />
          </CardContent>
        </Card>
      )}

      {/* Observations */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="font-semibold text-sm">Observações</Label>
          <Textarea
            rows={2}
            placeholder="Observações adicionais..."
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            disabled={isCompleted}
          />
        </CardContent>
      </Card>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Preencha os campos obrigatórios:</p>
                <ul className="text-xs text-destructive/80 space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons - fixed bottom */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 flex gap-3 z-50">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : showSaved ? (
              <CheckCircle className="h-4 w-4 mr-2 text-emerald-500" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {showSaved ? "Salvo!" : "Salvar"}
          </Button>
          <Button
            className="flex-1"
            onClick={handleComplete}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Concluir
          </Button>
        </div>
      )}
    </div>
  );
}
