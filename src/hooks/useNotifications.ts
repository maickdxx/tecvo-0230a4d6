import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const VAPID_PUBLIC_KEY_STORAGE = "tecvo_vapid_public_key";

interface NotificationPreferences {
  new_service: boolean;
  new_schedule: boolean;
  recurrence_alert: boolean;
  goal_reached: boolean;
  whatsapp_message: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  new_service: true,
  new_schedule: true,
  recurrence_alert: true,
  goal_reached: true,
  whatsapp_message: true,
};

type PermissionStatus = "granted" | "denied" | "default" | "unsupported";

export function useNotifications() {
  const { user, profile } = useAuth();
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  const isSupported = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;

  useEffect(() => {
    if (!isSupported) {
      setPermissionStatus("unsupported");
      return;
    }
    setPermissionStatus(Notification.permission as PermissionStatus);
  }, [isSupported]);

  // Load preferences directly from DB
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.notification_preferences && typeof data.notification_preferences === "object") {
          setPreferences({
            ...DEFAULT_PREFERENCES,
            ...(data.notification_preferences as Partial<NotificationPreferences>),
          });
        }
      });
  }, [user]);

  // Use the PWA service worker (which now has sw-push.js imported via workbox importScripts)
  const getRegistration = async () => {
    return navigator.serviceWorker.ready;
  };

  // Check existing subscription and auto-subscribe if permission already granted
  useEffect(() => {
    if (!isSupported || !user || !profile) return;
    checkAndAutoSubscribe();
  }, [isSupported, user, profile]);

  const checkAndAutoSubscribe = async () => {
    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager?.getSubscription();

      if (subscription) {
        setIsSubscribed(true);
        // Ensure token is saved in DB (in case it was lost)
        await saveTokenIfNeeded(subscription);
        return;
      }

      if (Notification.permission === "granted") {
        await autoSubscribe();
      } else {
        setIsSubscribed(false);
      }
    } catch {
      setIsSubscribed(false);
    }
  };

  const saveTokenIfNeeded = async (subscription: PushSubscription) => {
    if (!user || !profile) return;
    const json = subscription.toJSON();
    if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return;

    await supabase.from("notification_tokens").upsert(
      {
        user_id: user.id,
        organization_id: profile.organization_id,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        device_info: navigator.userAgent.substring(0, 100),
      },
      { onConflict: "user_id,endpoint" }
    );
  };

  const autoSubscribe = async () => {
    try {
      const registration = await getRegistration();
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        setIsSubscribed(false);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      await saveTokenIfNeeded(subscription);
      setIsSubscribed(true);
    } catch (err) {
      console.error("Auto-subscribe failed:", err);
      setIsSubscribed(false);
    }
  };

  const getVapidKey = async (): Promise<string | null> => {
    const cached = localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE);
    if (cached) return cached;
    try {
      const { data, error } = await supabase.functions.invoke("generate-vapid-keys", {
        body: { action: "get-public-key" },
      });
      if (error || !data?.publicKey) return null;
      localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE, data.publicKey);
      return data.publicKey;
    } catch {
      return null;
    }
  };

  const urlBase64ToUint8Array = (base64String: string): Uint8Array<ArrayBuffer> => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const outputArray = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const requestPermission = useCallback(async () => {
    if (!isSupported || !user || !profile) return false;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionStatus(permission as PermissionStatus);

      if (permission !== "granted") {
        toast({ title: "Permissão negada", description: "Você pode reativar nas configurações do navegador.", variant: "destructive" });
        return false;
      }

      const registration = await getRegistration();

      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        toast({ title: "Erro de configuração", description: "Chaves VAPID não configuradas. Entre em contato com o suporte.", variant: "destructive" });
        return false;
      }

      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        }));

      const subscriptionJson = subscription.toJSON();

      const { error } = await supabase.from("notification_tokens").upsert(
        {
          user_id: user.id,
          organization_id: profile.organization_id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh!,
          auth: subscriptionJson.keys!.auth!,
          device_info: navigator.userAgent.substring(0, 100),
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) throw error;

      setIsSubscribed(true);
      toast({ title: "Notificações ativadas", description: "Você receberá alertas neste dispositivo." });
      return true;
    } catch (err: any) {
      console.error("Push subscription error:", err);
      toast({ title: "Erro ao ativar notificações", description: err.message || "Tente novamente.", variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  }, [isSupported, user, profile]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const registration = await getRegistration();
      const subscription = await registration.pushManager?.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await supabase.from("notification_tokens").delete().eq("user_id", user.id).eq("endpoint", endpoint);
      }

      setIsSubscribed(false);
      toast({ title: "Notificações desativadas", description: "Você não receberá mais alertas neste dispositivo." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível desativar as notificações.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user]);

  const updatePreferences = useCallback(
    async (newPreferences: Partial<NotificationPreferences>) => {
      if (!user) return;
      const updated = { ...preferences, ...newPreferences };
      setPreferences(updated);

      try {
        const { error } = await supabase.from("profiles").update({ notification_preferences: updated }).eq("user_id", user.id);
        if (error) throw error;
      } catch {
        toast({ title: "Erro", description: "Não foi possível salvar as preferências.", variant: "destructive" });
        setPreferences(preferences);
      }
    },
    [user, preferences]
  );

  return { isSupported, permissionStatus, isSubscribed, loading, preferences, requestPermission, unsubscribe, updatePreferences };
}
