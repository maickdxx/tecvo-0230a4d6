import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ClientPortalSession {
  token: string;
  clientId: string;
  organizationId: string;
}

interface PortalConfig {
  display_name: string | null;
  welcome_message: string | null;
  contact_phone: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

interface ClientPortalData {
  client: { id: string; name: string; phone: string; maintenance_reminder_enabled?: boolean } | null;
  organization: { name: string; phone: string | null; whatsapp_owner: string | null; logo_url: string | null } | null;
  portal_config: PortalConfig | null;
  services: ClientService[];
}

export interface ClientService {
  id: string;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  value: number | null;
  description: string | null;
  operational_status: string | null;
  assigned_to: string | null;
  entry_date: string | null;
  technician_name: string | null;
  photos: { photo_url: string; photo_type: string | null; description: string | null }[];
  equipment: { name: string; brand: string | null; model: string | null; technical_report: string | null; defects: string | null; solution: string | null }[];
}

export interface VerificationChannel {
  type: string;
  label: string;
  masked: string;
}

interface TokenIdentifyResult {
  session_id: string;
  client_name: string;
  channels: VerificationChannel[];
  branding: {
    name: string | null;
    logo_url: string | null;
    primary_color: string | null;
  };
}

interface ClientPortalContextType {
  session: ClientPortalSession | null;
  data: ClientPortalData | null;
  isLoading: boolean;
  error: string | null;
  sendOtp: (phone: string) => Promise<{ sessionId: string; clientName: string } | { error: string }>;
  verifyOtp: (sessionId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  identifyToken: (token: string) => Promise<TokenIdentifyResult | { error: string }>;
  sendVerification: (sessionId: string, channel: string) => Promise<{ success: boolean; error?: string }>;
  verifyTokenCode: (sessionId: string, code: string) => Promise<{ success: boolean; error?: string }>;
  validateToken: (token: string) => Promise<boolean>;
  loadData: () => Promise<void>;
  toggleReminder: (enabled: boolean) => Promise<void>;
  logout: () => void;
}

const ClientPortalContext = createContext<ClientPortalContextType | undefined>(undefined);

const STORAGE_KEY = "tecvo_client_portal";

export function ClientPortalProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ClientPortalSession | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });
  const [data, setData] = useState<ClientPortalData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveSession = (s: ClientPortalSession) => {
    setSession(s);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  };

  const sendOtp = async (phone: string) => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "send_otp", phone },
      });
      if (error) return { error: "Erro ao enviar código" };
      if (res?.error) return { error: res.error };
      return { sessionId: res.session_id, clientName: res.client_name };
    } catch {
      return { error: "Erro de conexão" };
    }
  };

  const verifyOtp = async (sessionId: string, code: string) => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "verify_otp", session_id: sessionId, code },
      });
      if (error || res?.error) return { success: false, error: res?.error || "Erro ao verificar código" };
      saveSession({ token: res.token, clientId: res.client_id, organizationId: res.organization_id });
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const identifyToken = async (token: string): Promise<TokenIdentifyResult | { error: string }> => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "identify_token", token },
      });
      if (error || res?.error) return { error: res?.error || "Erro ao identificar link" };
      return {
        session_id: res.session_id,
        client_name: res.client_name,
        channels: res.channels,
        branding: res.branding,
      };
    } catch {
      return { error: "Erro de conexão" };
    }
  };

  const sendVerification = async (sessionId: string, channel: string) => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "send_verification", session_id: sessionId, channel },
      });
      if (error || res?.error) return { success: false, error: res?.error || "Erro ao enviar código" };
      if (res?.already_verified) {
        saveSession({ token: res.token, clientId: res.client_id, organizationId: res.organization_id });
        return { success: true };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const verifyTokenCode = async (sessionId: string, code: string) => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "verify_token_code", session_id: sessionId, code },
      });
      if (error || res?.error) return { success: false, error: res?.error || "Erro ao verificar código" };
      saveSession({ token: res.token, clientId: res.client_id, organizationId: res.organization_id });
      return { success: true };
    } catch {
      return { success: false, error: "Erro de conexão" };
    }
  };

  const validateToken = async (token: string) => {
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "validate_token", token },
      });
      if (error || res?.error) return false;
      saveSession({ token: res.token, clientId: res.client_id, organizationId: res.organization_id });
      return true;
    } catch {
      return false;
    }
  };

  const loadData = async () => {
    if (!session) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("client-portal-auth", {
        body: { action: "get_data", token: session.token },
      });
      if (error || res?.error) {
        if (res?.error === "Sessão expirada") {
          logout();
        }
        setError(res?.error || "Erro ao carregar dados");
        return;
      }
      setData(res);
    } catch {
      setError("Erro de conexão");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleReminder = async (enabled: boolean) => {
    if (!session) return;
    try {
      await supabase.functions.invoke("client-portal-auth", {
        body: { action: "toggle_reminder", token: session.token, enabled },
      });
      if (data?.client) {
        setData({ ...data, client: { ...data.client, maintenance_reminder_enabled: enabled } });
      }
    } catch {}
  };

  const logout = () => {
    setSession(null);
    setData(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    if (session && !data) {
      loadData();
    }
  }, [session]);

  return (
    <ClientPortalContext.Provider value={{
      session, data, isLoading, error,
      sendOtp, verifyOtp, identifyToken, sendVerification, verifyTokenCode,
      validateToken, loadData, toggleReminder, logout
    }}>
      {children}
    </ClientPortalContext.Provider>
  );
}

export function useClientPortal() {
  const ctx = useContext(ClientPortalContext);
  if (!ctx) throw new Error("useClientPortal must be used within ClientPortalProvider");
  return ctx;
}
