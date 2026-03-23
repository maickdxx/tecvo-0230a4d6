import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";
import { Loader2, ExternalLink } from "lucide-react";

export function AdminTestCheckout() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { plan: "teste" },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        saveCheckoutContext({ plan: "teste", returnTo: buildCheckoutSuccessPath("teste") });
        window.open(data.url, "_blank");
      } else {
        setError("Nenhuma URL retornada do checkout.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Checkout de Teste</CardTitle>
        <CardDescription>
          Plano <strong>teste</strong> — R$ 1,00/mês. Fluxo real completo via Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleCheckout} disabled={loading} size="lg" className="gap-2">
          {loading ? <Loader2 className="animate-spin h-4 w-4" /> : <ExternalLink className="h-4 w-4" />}
          {loading ? "Abrindo checkout..." : "Iniciar Checkout R$ 1,00"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
