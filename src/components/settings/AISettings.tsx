import { ArrowLeft, Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAISettings, type AISettings as AISettingsType } from "@/hooks/useAISettings";
import { useProfile } from "@/hooks/useProfile";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { useOrganization } from "@/hooks/useOrganization";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useEffect } from "react";

interface AISettingsProps {
  onBack: () => void;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return digits;
};

const settingsOptions: {
  key: keyof AISettingsType;
  label: string;
  description: string;
}[] = [
  {
    key: "enabled",
    label: "Ativar IA",
    description: "Ativa ou desativa todas as funcionalidades da IA",
  },
  {
    key: "show_alerts",
    label: "Mostrar alertas operacionais",
    description: "Exibe cards de insights e alertas ao abrir a IA",
  },
  {
    key: "show_auto_summary",
    label: "Mostrar resumo automático ao abrir",
    description: "Exibe um resumo operacional compacto ao acessar a IA",
  },
  {
    key: "chat_only_mode",
    label: "Modo somente chat",
    description: "Desativa alertas e resumo, mantém apenas o chat",
  },
  {
    key: "show_financial_alerts",
    label: "Mostrar alertas financeiros",
    description: "Exibe alertas de pagamentos vencidos e risco de caixa",
  },
  {
    key: "show_agenda_alerts",
    label: "Mostrar alertas de agenda",
    description: "Exibe alertas de serviços agendados e próximos",
  },
];

export function AISettings({ onBack }: AISettingsProps) {
  const { settings, updateSetting, isLoading } = useAISettings();
  const { profile } = useProfile();
  const { sensitiveData } = useProfileSensitiveData();
  const { organization, update: updateOrganization, isUpdating: isUpdatingOrganization } = useOrganization();
  const { isOwner } = useUserRole();
  // WhatsApp personal logic removed - now in My Account settings

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
             <h1 className="text-2xl font-bold text-foreground">Laura</h1>
             <p className="text-muted-foreground">Configure sua assistente operacional</p>
          </div>
        </div>
      </div>

      {/* WhatsApp card removed - now in My Account settings */}

      {/* Comportamento da IA */}
      <div className="space-y-1">
        {settingsOptions.map((option) => {
          const isDisabled =
            !settings.enabled && option.key !== "enabled";

          return (
            <div
              key={option.key}
              className={`flex items-center justify-between rounded-xl border border-border bg-card p-4 ${
                isDisabled ? "opacity-50" : ""
              }`}
            >
              <div className="flex-1 mr-4">
                <Label className="text-sm font-medium text-card-foreground">
                  {option.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {option.description}
                </p>
              </div>
              <Switch
                checked={settings[option.key]}
                onCheckedChange={(value) => updateSetting(option.key, value)}
                disabled={isDisabled}
              />
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        As configurações são salvas automaticamente na sua conta.
      </p>
    </div>
  );
}
