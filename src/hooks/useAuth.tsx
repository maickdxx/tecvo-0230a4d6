import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardLayoutItem {
  id: string;
  visible: boolean;
}

interface Profile {
  id: string;
  user_id: string;
  organization_id: string;
  full_name: string | null;
  phone: string | null;
  dashboard_layout: DashboardLayoutItem[] | null;
  field_worker?: boolean;
  employee_type?: string;
  avatar_url?: string | null;
  position?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  organizationId: string | null;
  isLoading: boolean;
  signUpSuccess: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setSignUpSuccess: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [signUpSuccess, setSignUpSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => {
            if (mounted) fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const timeout = setTimeout(() => {
      if (mounted) setIsLoading(false);
    }, 5000);

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, organization_id, full_name, phone, dashboard_layout, field_worker, employee_type, avatar_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data ? { ...data, dashboard_layout: (Array.isArray(data.dashboard_layout) ? data.dashboard_layout as unknown as DashboardLayoutItem[] : null) } : null);

      // Update last_access silently (once per session load)
      if (data) {
        supabase
          .from("profiles")
          .update({ last_access: new Date().toISOString() })
          .eq("user_id", userId)
          .then(() => {});

        // Check if welcome WhatsApp needs to be sent
        if (data.organization_id) {
          supabase
            .from("organizations")
            .select("onboarding_completed, welcome_whatsapp_sent")
            .eq("id", data.organization_id)
            .maybeSingle()
            .then(({ data: org }) => {
              if (org?.onboarding_completed && !org?.welcome_whatsapp_sent) {
                supabase.functions.invoke("send-welcome-whatsapp").catch((err) => {
                  console.warn("Welcome WhatsApp retry failed:", err);
                });
              }
            });
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        // Handle "User already registered" error from Supabase
        if (error.message?.toLowerCase().includes("already registered") || 
            error.message?.toLowerCase().includes("already been registered") ||
            (error as any).code === "user_already_exists") {
          return { error: new Error("Este email já está cadastrado. Faça login ou use 'Esqueci minha senha'.") };
        }
        return { error };
      }

      // Check for fake signup (user already exists but unconfirmed — Supabase returns empty identities)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        return { error: new Error("Este email já está cadastrado. Faça login ou use 'Esqueci minha senha'.") };
      }

      // Send OTP verification email via edge function
      try {
        await supabase.functions.invoke("send-verification-email", {
          body: { email, fullName },
        });
      } catch (otpErr) {
        console.error("Failed to send verification email:", otpErr);
      }

      setSignUpSuccess(true);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        organizationId: profile?.organization_id ?? null,
        isLoading,
        signUpSuccess,
        signUp,
        signIn,
        signOut,
        refreshProfile,
        setSignUpSuccess,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
