import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";
...
      analytics.track("signup_completed", data.user?.id || null, null, {}, true);
      trackFBEvent("StartTrial", { content_name: "7_day_trial", currency: "BRL", value: 0 });
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
    analytics.track("logout", user?.id || null, profile?.organization_id || null);
    sessionStorage.removeItem("tecvo_login_tracked");
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
