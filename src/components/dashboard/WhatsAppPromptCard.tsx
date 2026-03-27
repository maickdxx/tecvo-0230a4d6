import { useState, useEffect } from "react";
import { MessageCircle, X, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useDemoMode } from "@/hooks/useDemoMode";

const DISMISS_KEY = "whatsapp_prompt_dismissed_at";

export function WhatsAppPromptCard() {
  const { user, profile } = useAuth();
  const { data: sensitiveData } = useProfileSensitiveData();
  const { isDemoMode } = useDemoMode();
  const [dismissed, setDismissed] = useState(true);
  const [editing, setEditing] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);

  const hasWhatsapp = !!(profile?.phone || sensitiveData?.whatsapp_personal);

  useEffect(() => {
    if (!user || isDemoMode || hasWhatsapp) {
      setDismissed(true);
      return;
    }
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const elapsed = Date.now() - Number(dismissedAt);
      setDismissed(elapsed < 24 * 60 * 60 * 1000);
    } else {
      setDismissed(false);
    }
  }, [user, isDemoMode, hasWhatsapp]);

  if (dismissed || hasWhatsapp || !user || isDemoMode) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const handleSave = async () => {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Número inválido. Use DDD + número.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ phone: digits, whatsapp_personal: digits })
      .eq("user_id", user!.id);

    if (error) {
      toast.error("Erro ao salvar WhatsApp");
    } else {
      toast.success("WhatsApp adicionado com sucesso!");
      setDismissed(true);
    }
    setSaving(false);
  };

  const formatInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    setWhatsapp(formatted);
  };

  return (
    <div className="relative flex items-center gap-3 p-4 rounded-lg border border-primary/20 bg-primary/5 mb-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MessageCircle className="h-4.5 w-4.5 text-primary" />
      </div>

      {!editing ? (
        <div className="flex flex-1 items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Ative seu WhatsApp</p>
            <p className="text-xs text-muted-foreground">Receba atualizações dos seus atendimentos e automações direto no WhatsApp</p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={() => setEditing(true)}>
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Adicionar WhatsApp</span>
            <span className="sm:hidden">Adicionar</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="(11) 99999-9999"
            value={whatsapp}
            onChange={(e) => formatInput(e.target.value)}
            className="h-9 max-w-[200px]"
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1 shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="shrink-0">
            Cancelar
          </Button>
        </div>
      )}

      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
