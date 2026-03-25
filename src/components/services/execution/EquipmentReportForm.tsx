import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Mic,
  ChevronRight,
  ChevronLeft,
  Thermometer,
  Zap,
} from "lucide-react";
import { ReportPhotoUploader } from "@/components/laudos/ReportPhotoUploader";
import { useReportPhotos } from "@/hooks/useReportPhotos";
import { toast } from "@/hooks/use-toast";
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
  standardChecklist?: string[];
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

const QUICK_PROBLEMS = [
  "Falta de gás",
  "Filtro sujo",
  "Capacitor danificado",
  "Vazamento no dreno",
  "Compressor não parte",
  "Placa eletrônica com erro",
];

const QUICK_SOLUTIONS = [
  "Carga de gás realizada",
  "Limpeza técnica profunda",
  "Substituição de capacitor",
  "Desobstrução do dreno",
  "Reparo na fiação elétrica",
  "Orientação de uso ao cliente",
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

const PHOTO_REQUIRED_TYPES = ["limpeza", "pmoc", "instalacao", "manutencao_preventiva"];

export function EquipmentReportForm({
  equipment,
  reportId,
  onBack,
  onAutoSave,
  onSave,
  onComplete,
  standardChecklist = [],
}: EquipmentReportFormProps) {
  const rd = equipment.reportData;
  const [step, setStep] = useState(1);
  const [serviceType, setServiceType] = useState(rd?.service_type_performed || "");
  const [problem, setProblem] = useState(rd?.problem_identified || "");
  const [workPerformed, setWorkPerformed] = useState(rd?.work_performed || "");
  const [observations, setObservations] = useState(rd?.observations || "");
  const [checklist, setChecklist] = useState<string[]>(rd?.checklist || []);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);

  const { photos } = useReportPhotos(reportId || undefined, equipment.id);
  const isCompleted = rd?.status === "completed";
  const totalSteps = 4;

  const validateStep = (currentStep: number) => {
    const errors: string[] = [];
    if (currentStep === 1 && !serviceType) errors.push("Selecione o tipo de serviço");
    if (currentStep === 4) {
      if (!problem.trim()) errors.push("Descreva o problema");
      if (!workPerformed.trim()) errors.push("Descreva o que foi feito");
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, totalSteps));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const handleServiceTypeChange = (value: string) => {
    setServiceType(value);
    setChecklist([]);
  };

  const toggleChecklist = (key: string) => {
    if (isCompleted) return;
    setChecklist((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const startVoiceDictation = (field: "problem" | "work" | "obs") => {
    if (!('webkitSpeechRecognition' in window)) {
      toast({ title: "Ops!", description: "Ditado por voz não suportado neste navegador.", variant: "destructive" });
      return;
    }
    
    setIsListening(true);
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      if (field === "problem") setProblem(p => p + " " + text);
      if (field === "work") setWorkPerformed(p => p + " " + text);
      if (field === "obs") setObservations(p => p + " " + text);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleComplete = async () => {
    if (!validateStep(4)) return;
    
    // Intelligent Photo Check
    const requiresPhotos = PHOTO_REQUIRED_TYPES.includes(serviceType);
    const hasBefore = photos.some(p => p.category === "before");
    const hasAfter = photos.some(p => p.category === "after");
    
    if (requiresPhotos && (!hasBefore || !hasAfter)) {
      const confirm = window.confirm("Você não adicionou fotos de antes/depois. Deseja finalizar assim mesmo?");
      if (!confirm) {
        setStep(3);
        return;
      }
    }

    setIsCompleting(true);
    try {
      await onSave(equipment.id, {
        service_type_performed: serviceType,
        problem_identified: problem,
        work_performed: workPerformed,
        observations: observations,
        checklist,
        status: "completed",
      });
      await onComplete(equipment.id);
    } finally {
      setIsCompleting(false);
    }
  };

  const checklistItems = serviceType
    ? CHECKLIST_BY_TYPE[serviceType] || DEFAULT_CHECKLIST
    : DEFAULT_CHECKLIST;

  return (
    <div className="flex flex-col h-full bg-background pb-24">
      {/* Header & Progress */}
      <div className="sticky top-0 bg-background/80 backdrop-blur-md z-40 p-4 border-b space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate">{equipment.name}</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
              Etapa {step} de {totalSteps}
            </p>
          </div>
          {isCompleted && (
            <Badge className="bg-emerald-500 text-white border-none text-[10px]">CONCLUÍDO</Badge>
          )}
        </div>
        <Progress value={(step / totalSteps) * 100} className="h-1.5" />
      </div>

      <div className="p-4 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        
        {/* STEP 1: SERVICE TYPE */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-bold flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" /> O que foi feito?
              </Label>
              <p className="text-sm text-muted-foreground">Selecione o tipo de serviço principal realizado.</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {SERVICE_TYPES.map((t) => (
                <Button
                  key={t.value}
                  variant={serviceType === t.value ? "default" : "outline"}
                  className={`justify-start h-14 text-left px-4 rounded-xl ${
                    serviceType === t.value ? "ring-2 ring-primary ring-offset-2" : ""
                  }`}
                  onClick={() => handleServiceTypeChange(t.value)}
                  disabled={isCompleted}
                >
                  <div className="flex flex-col">
                    <span className="font-bold">{t.label}</span>
                  </div>
                  {serviceType === t.value && <CheckCircle className="ml-auto h-5 w-5" />}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: CHECKLIST */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-bold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" /> Checklist Técnico
              </Label>
              <p className="text-sm text-muted-foreground">Marque os itens verificados durante o serviço.</p>
            </div>
            <div className="space-y-2">
              {checklistItems.map((item) => (
                <Card 
                  key={item.key} 
                  className={`cursor-pointer transition-all border-2 ${checklist.includes(item.key) ? "border-primary bg-primary/5" : "border-transparent"}`}
                  onClick={() => toggleChecklist(item.key)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Checkbox
                      checked={checklist.includes(item.key)}
                      onCheckedChange={() => toggleChecklist(item.key)}
                      className="h-5 w-5 rounded-md"
                      disabled={isCompleted}
                    />
                    <span className="font-medium text-sm">{item.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: PHOTOS */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-bold flex items-center gap-2">
                <Camera className="h-5 w-5 text-primary" /> Registros Fotográficos
              </Label>
              <p className="text-sm text-muted-foreground">Capture fotos de "Antes" e "Depois" para comprovar o serviço.</p>
            </div>
            {reportId && (
              <div className="bg-muted/30 rounded-2xl p-4 border border-dashed">
                <ReportPhotoUploader
                  reportId={reportId}
                  equipmentId={equipment.id}
                />
              </div>
            )}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Fotos de qualidade aumentam a confiança do cliente e evitam retornos desnecessários.
              </p>
            </div>
          </div>
        )}

        {/* STEP 4: TECHNICAL DATA */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label className="text-lg font-bold">Relatório Técnico</Label>
              <p className="text-sm text-muted-foreground">Detalhe o que foi encontrado e resolvido.</p>
            </div>

            {/* Problem Identified */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Problema Encontrado *</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className={`h-8 px-2 text-primary ${isListening ? "animate-pulse bg-red-50 text-red-500" : ""}`}
                  onClick={() => startVoiceDictation("problem")}
                  disabled={isCompleted}
                >
                  <Mic className="h-4 w-4 mr-1" /> Ditado
                </Button>
              </div>
              <Textarea
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                placeholder="Ex: Ar condicionado não estava gelando..."
                className="min-h-[100px] rounded-xl"
                disabled={isCompleted}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_PROBLEMS.map(p => (
                  <Button 
                    key={p} 
                    variant="outline" 
                    size="sm" 
                    className="text-[10px] h-7 rounded-full"
                    onClick={() => setProblem(prev => prev ? prev + ", " + p : p)}
                    disabled={isCompleted}
                  >
                    + {p}
                  </Button>
                ))}
              </div>
            </div>

            {/* Work Performed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-bold">Serviço Realizado *</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-primary"
                  onClick={() => startVoiceDictation("work")}
                  disabled={isCompleted}
                >
                  <Mic className="h-4 w-4 mr-1" /> Ditado
                </Button>
              </div>
              <Textarea
                value={workPerformed}
                onChange={(e) => setWorkPerformed(e.target.value)}
                placeholder="Ex: Realizada carga de gás e limpeza..."
                className="min-h-[100px] rounded-xl"
                disabled={isCompleted}
              />
              <div className="flex flex-wrap gap-2">
                {QUICK_SOLUTIONS.map(s => (
                  <Button 
                    key={s} 
                    variant="outline" 
                    size="sm" 
                    className="text-[10px] h-7 rounded-full"
                    onClick={() => setWorkPerformed(prev => prev ? prev + ", " + s : s)}
                    disabled={isCompleted}
                  >
                    + {s}
                  </Button>
                ))}
              </div>
            </div>

            {/* Additional Fields for Diagnosis */}
            {serviceType === "diagnostico" && (
              <div className="p-4 bg-primary/5 rounded-2xl border border-primary/20 space-y-4">
                <Label className="font-bold flex items-center gap-2">
                  <Thermometer className="h-4 w-4" /> Medições Técnicas
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Corrente (A)</Label>
                    <input type="text" className="w-full bg-background border rounded-lg p-2 text-sm" placeholder="0.0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pressão (PSI)</Label>
                    <input type="text" className="w-full bg-background border rounded-lg p-2 text-sm" placeholder="0" />
                  </div>
                </div>
              </div>
            )}

            {/* Observations */}
            <div className="space-y-2">
              <Label className="font-bold">Observações Internas</Label>
              <Textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Algo para o escritório saber?"
                className="min-h-[80px] rounded-xl"
                disabled={isCompleted}
              />
            </div>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-xl animate-in zoom-in-95">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">{validationErrors[0]}</span>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-lg border-t flex gap-3 z-50">
        {step > 1 ? (
          <Button variant="outline" size="lg" className="flex-1 h-14 rounded-2xl" onClick={prevStep}>
            <ChevronLeft className="mr-2 h-5 w-5" /> Voltar
          </Button>
        ) : (
          <Button variant="outline" size="lg" className="flex-1 h-14 rounded-2xl" onClick={onBack}>
            Sair
          </Button>
        )}

        {step < totalSteps ? (
          <Button size="lg" className="flex-[2] h-14 rounded-2xl shadow-lg shadow-primary/20" onClick={nextStep}>
            Próximo <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        ) : (
          !isCompleted && (
            <Button 
              size="lg" 
              className="flex-[2] h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
              onClick={handleComplete}
              disabled={isCompleting}
            >
              {isCompleting ? <Loader2 className="animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}
              Concluir Equipamento
            </Button>
          )
        )}
      </div>
    </div>
  );
}
