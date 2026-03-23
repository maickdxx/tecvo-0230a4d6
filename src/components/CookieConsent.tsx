import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Cookie } from "lucide-react";

const COOKIE_CONSENT_KEY = "tecvo_cookie_consent";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      // Small delay so it doesn't flash on first render
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-300">
      <div className="container mx-auto max-w-3xl">
        <div className="bg-card border border-border rounded-xl shadow-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm text-foreground/80 flex-1">
            Utilizamos cookies essenciais para o funcionamento da plataforma e cookies analíticos para melhorar sua experiência.
            Saiba mais na nossa{" "}
            <Link to="/politica-de-cookies" className="text-primary hover:underline font-medium">
              Política de Cookies
            </Link>.
          </p>
          <Button size="sm" onClick={handleAccept} className="shrink-0">
            Aceitar
          </Button>
        </div>
      </div>
    </div>
  );
}
