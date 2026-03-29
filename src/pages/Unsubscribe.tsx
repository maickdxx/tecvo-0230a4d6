import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === true) setState("valid");
        else if (data.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("error"));
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (data?.success) setState("success");
      else if (data?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center">
        {state === "loading" && <p className="text-muted-foreground">Verificando...</p>}
        {state === "valid" && (
          <>
            <h1 className="text-xl font-bold mb-4 text-foreground">Cancelar inscrição</h1>
            <p className="text-muted-foreground mb-6">
              Deseja parar de receber emails da Tecvo?
            </p>
            <button
              onClick={handleUnsubscribe}
              disabled={processing}
              className="bg-destructive text-destructive-foreground px-6 py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
            >
              {processing ? "Processando..." : "Confirmar cancelamento"}
            </button>
          </>
        )}
        {state === "success" && (
          <>
            <h1 className="text-xl font-bold mb-4 text-foreground">✅ Inscrição cancelada</h1>
            <p className="text-muted-foreground">Você não receberá mais emails da Tecvo.</p>
          </>
        )}
        {state === "already" && (
          <>
            <h1 className="text-xl font-bold mb-4 text-foreground">Já cancelado</h1>
            <p className="text-muted-foreground">Sua inscrição já foi cancelada anteriormente.</p>
          </>
        )}
        {state === "invalid" && (
          <p className="text-destructive">Link inválido ou expirado.</p>
        )}
        {state === "error" && (
          <p className="text-destructive">Erro ao processar. Tente novamente.</p>
        )}
      </div>
    </div>
  );
};

export default Unsubscribe;
