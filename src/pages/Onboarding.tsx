import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { OnboardingCompanyStep } from "@/components/onboarding";
import { Loader2 } from "lucide-react";

export default function Onboarding() {
  const { user, isLoading: authLoading } = useAuth();
  const { isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const [isSeeding, setIsSeeding] = useState(false);
  const navigate = useNavigate();

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleFinish = async () => {
    setIsSeeding(true);
    try {
      await completeOnboarding();
      navigate("/dashboard");
    } catch (err) {
      console.error("Error finishing onboarding:", err);
      navigate("/dashboard");
    } finally {
      setIsSeeding(false);
    }
  };

  if (isSeeding) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Salvando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Tecvo</h1>
          <p className="text-muted-foreground">Vamos criar sua empresa agora — leva menos de 30 segundos</p>
        </div>

        <div className="bg-card rounded-xl shadow-lg p-6 md:p-8">
          <OnboardingCompanyStep onNext={handleFinish} />
        </div>
      </div>
    </div>
  );
}
