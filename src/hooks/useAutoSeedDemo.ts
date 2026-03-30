import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Auto-seeds demo data for new users who have no real data.
 * Returns isPreparing=true until data is confirmed ready.
 */
export function useAutoSeedDemo() {
  const { profile, session } = useAuth();
  const { isDemoMode, isLoading: demoLoading } = useDemoMode();
  const queryClient = useQueryClient();
  const seeded = useRef(false);
  const [isPreparing, setIsPreparing] = useState(true);

  useEffect(() => {
    if (demoLoading || !profile?.organization_id || !session) return;

    // Already in demo mode — data exists, ready immediately
    if (isDemoMode) {
      setIsPreparing(false);
      return;
    }

    if (seeded.current) {
      setIsPreparing(false);
      return;
    }

    const checkAndSeed = async () => {
      try {
        const { count } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id)
          .is("deleted_at", null);

        if ((count ?? 0) > 0) {
          seeded.current = true;
          setIsPreparing(false);
          return;
        }

        const { count: svcCount } = await supabase
          .from("services")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", profile.organization_id)
          .is("deleted_at", null);

        if ((svcCount ?? 0) > 0) {
          seeded.current = true;
          setIsPreparing(false);
          return;
        }

        // No data — seed demo and WAIT for completion
        seeded.current = true;
        await supabase.functions.invoke("seed-demo-data");

        // Refresh all queries and wait for them
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["demo-mode"] }),
          queryClient.invalidateQueries({ queryKey: ["services"] }),
          queryClient.invalidateQueries({ queryKey: ["clients"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] }),
          queryClient.invalidateQueries({ queryKey: ["current-situation"] }),
          queryClient.invalidateQueries({ queryKey: ["closed-period-services"] }),
          queryClient.invalidateQueries({ queryKey: ["alertas-inteligentes"] }),
          queryClient.invalidateQueries({ queryKey: ["guided-onboarding"] }),
          queryClient.invalidateQueries({ queryKey: ["organization"] }),
        ]);

        setIsPreparing(false);
      } catch (err) {
        console.warn("Auto seed demo failed:", err);
        setIsPreparing(false);
      }
    };

    checkAndSeed();
  }, [profile?.organization_id, session, isDemoMode, demoLoading, queryClient]);

  return { isPreparing };
}
