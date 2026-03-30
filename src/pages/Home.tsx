import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { trackFBEvent } from "@/lib/fbPixel";
import {
  LandingHeader,
  HeroSection,
  PainSection,
  SolutionSection,
  SystemShowcase,
  BenefitsSection,
  DifferentiationSection,
  SocialProof,
  PricingSection,
  CTASection,
  LandingFooter,
} from "@/components/landing";

export default function Home() {
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      trackFBEvent("ViewContent", { content_name: "Landing Page", content_category: "landing" });
    }
  }, [isLoading, user]);

  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main>
        <HeroSection />
        <PainSection />
        <SolutionSection />
        <SystemShowcase />
        <BenefitsSection />
        <DifferentiationSection />
        <SocialProof />
        <PricingSection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
