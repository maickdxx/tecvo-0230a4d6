import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface AISettings {
  enabled: boolean;
  show_alerts: boolean;
  show_auto_summary: boolean;
  chat_only_mode: boolean;
  show_financial_alerts: boolean;
  show_agenda_alerts: boolean;
}

const defaultSettings: AISettings = {
  enabled: true,
  show_alerts: true,
  show_auto_summary: true,
  chat_only_mode: false,
  show_financial_alerts: true,
  show_agenda_alerts: true,
};

export function useAISettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AISettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", user.id)
        .single();

      if (data?.notification_preferences) {
        const prefs = data.notification_preferences as Record<string, unknown>;
        const saved = prefs?.ai_settings as Partial<AISettings> | undefined;
        if (saved) {
          setSettings({ ...defaultSettings, ...saved });
        }
      }
      setIsLoading(false);
    };

    load();
  }, [user]);

  const updateSetting = useCallback(
    async (key: keyof AISettings, value: boolean) => {
      if (!user) return;

      const newSettings = { ...settings, [key]: value };
      const prev = settings;
      setSettings(newSettings);

      // Read current prefs first
      const { data } = await supabase
        .from("profiles")
        .select("notification_preferences")
        .eq("user_id", user.id)
        .single();

      const prefs = (data?.notification_preferences as Record<string, unknown>) || {};
      const updatedPrefs = { ...prefs, ai_settings: newSettings };

      const { error } = await supabase
        .from("profiles")
        .update({ notification_preferences: updatedPrefs })
        .eq("user_id", user.id);

      if (error) {
        setSettings(prev);
        toast({
          title: "Erro",
          description: "Não foi possível salvar a configuração.",
          variant: "destructive",
        });
      }
    },
    [user, settings]
  );

  return { settings, updateSetting, isLoading };
}
