import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { analytics } from "@/lib/analytics";

interface ABTestVariant {
  id: string;
  test_id: string;
  name: string;
  config: any;
  is_control: boolean;
}

interface ABTest {
  id: string;
  name: string;
  is_active: boolean;
  traffic_percentage: number;
  variants: ABTestVariant[];
}

export function useABTest(testName: string) {
  const [variant, setVariant] = useState<ABTestVariant | null>(null);
  const [loading, setLoading] = useState(true);

  const getAnonymousId = useCallback(() => {
    let id = localStorage.getItem("tecvo_anon_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("tecvo_anon_id", id);
    }
    return id;
  }, []);

  useEffect(() => {
    async function initTest() {
      try {
        const anonId = getAnonymousId();
        
        // Check local storage for existing assignment for this test
        const savedVariant = localStorage.getItem(`ab_test_${testName}`);
        if (savedVariant) {
          setVariant(JSON.parse(savedVariant));
          setLoading(false);
          return;
        }

        // Fetch test and its variants
        const { data: testData, error: testError } = await supabase
          .from("ab_tests")
          .select("*, variants:ab_test_variants(*)")
          .eq("name", testName)
          .eq("is_active", true)
          .single();

        if (testError || !testData) {
          setLoading(false);
          return;
        }

        const test = testData as any;
        
        // Traffic splitting logic
        // Simple hash of anonId + testId to get a consistent 0-99 number
        const hash = Array.from(anonId + test.id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const bucket = hash % 100;

        if (bucket < test.traffic_percentage) {
          // Assign a variant
          // For 50/50 split between 2 variants
          const variantIndex = hash % test.variants.length;
          const selectedVariant = test.variants[variantIndex];

          setVariant(selectedVariant);
          localStorage.setItem(`ab_test_${testName}`, JSON.stringify(selectedVariant));

          // Log assignment to DB
          await supabase.from("ab_test_assignments").insert({
            test_id: test.id,
            variant_id: selectedVariant.id,
            anonymous_id: anonId
          });

          // Track assignment event
          analytics.track("interaction" as any, null, null, {
            event_category: "ab_test",
            event_action: "assigned",
            test_name: test.name,
            variant_name: selectedVariant.name,
            anonymous_id: anonId
          });
        }
      } catch (err) {
        console.error("Error in AB Test assignment:", err);
      } finally {
        setLoading(false);
      }
    }

    initTest();
  }, [testName, getAnonymousId]);

  return { variant, loading };
}
