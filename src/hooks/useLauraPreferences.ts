import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface LauraPreferences {
  service_started: boolean;
  service_completed: boolean;
  service_en_route: boolean;
  schedule_reminder: boolean;
  operational_alerts: boolean;
  laura_tips: boolean;
  channel_whatsapp: boolean;
  channel_internal: boolean;
}

const DEFAULT_PREFERENCES: LauraPreferences = {
  service_started: true,
  service_completed: true,
  service_en_route: true,
  schedule_reminder: true,
  operational_alerts: true,
  laura_tips: true,
  channel_whatsapp: true,
  channel_internal: true,
};

export function useLauraPreferences() {
  const { user, profile } = useAuth();
  const [preferences, setPreferences] = useState<LauraPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !profile?.organization_id) return;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("user_notification_preferences" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("organization_id", profile.organization_id)
        .maybeSingle();

      if (data) {
        setPreferences({
          service_started: (data as any).service_started ?? true,
          service_completed: (data as any).service_completed ?? true,
          service_en_route: (data as any).service_en_route ?? true,
          schedule_reminder: (data as any).schedule_reminder ?? true,
          operational_alerts: (data as any).operational_alerts ?? true,
          laura_tips: (data as any).laura_tips ?? true,
          channel_whatsapp: (data as any).channel_whatsapp ?? true,
          channel_internal: (data as any).channel_internal ?? true,
        });
      }
      setLoading(false);
    };

    load();
  }, [user, profile?.organization_id]);

  const updatePreference = useCallback(
    async (key: keyof LauraPreferences, value: boolean) => {
      if (!user || !profile?.organization_id) return;

      const updated = { ...preferences, [key]: value };
      setPreferences(updated);
      setSaving(true);

      try {
        const { error } = await supabase
          .from("user_notification_preferences" as any)
          .upsert(
            {
              user_id: user.id,
              organization_id: profile.organization_id,
              ...updated,
            } as any,
            { onConflict: "user_id,organization_id" }
          );

        if (error) throw error;
      } catch {
        toast({
          title: "Erro",
          description: "Não foi possível salvar a preferência.",
          variant: "destructive",
        });
        setPreferences(preferences);
      } finally {
        setSaving(false);
      }
    },
    [user, profile?.organization_id, preferences]
  );

  return { preferences, loading, saving, updatePreference };
}
