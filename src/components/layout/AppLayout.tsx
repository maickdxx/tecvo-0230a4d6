import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAutoCheckout } from "@/hooks/useAutoCheckout";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { BillingBanner } from "@/components/subscription/BillingBanner";
import { PaymentPendingOverlay } from "@/components/subscription/PaymentPendingOverlay";

import { DemoTourOverlay } from "@/components/demo/DemoTourOverlay";
import { OfflineIndicator } from "@/components/offline/OfflineIndicator";
import { InstallBanner } from "./InstallBanner";
import { BannerPriorityProvider, useBannerPriority } from "@/contexts/BannerPriorityContext";

interface AppLayoutProps {
  children: ReactNode;
  mobileFullscreen?: boolean;
  hideBannersOnMobileFullscreen?: boolean;
  desktopFullHeight?: boolean;
}

export function AppLayout({
  children,
  mobileFullscreen = false,
  hideBannersOnMobileFullscreen = false,
  desktopFullHeight = false,
}: AppLayoutProps) {
  return (
    <BannerPriorityProvider>
      <AppLayoutInner
        mobileFullscreen={mobileFullscreen}
        hideBannersOnMobileFullscreen={hideBannersOnMobileFullscreen}
        desktopFullHeight={desktopFullHeight}
      >
        {children}
      </AppLayoutInner>
    </BannerPriorityProvider>
  );
}

function AppLayoutInner({
  children,
  mobileFullscreen = false,
  hideBannersOnMobileFullscreen = false,
  desktopFullHeight = false,
}: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isMobileFullscreen = isMobile && mobileFullscreen;
  const showBanners = !(isMobileFullscreen && hideBannersOnMobileFullscreen);
  const { isPendingPayment, pendingPlan, cancelPending } = useAutoCheckout();
  const { isSuppressed } = useBannerPriority();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden max-w-[100vw]">
      {/* Desktop Sidebar */}
      {!isMobile && <Sidebar />}

      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNav sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      )}

      {/* Main Content — uses CSS variable-like approach for sidebar offset */}
      <main
        className={`
          transition-all duration-200
          ${isMobile 
            ? (isMobileFullscreen ? "h-[100dvh] overflow-hidden" : "pb-20") 
            : "sidebar-offset"
          }
          ${!isMobile && desktopFullHeight ? "h-screen overflow-hidden" : ""}
        `}
        style={{
          paddingTop: isMobile ? "calc(3.5rem + env(safe-area-inset-top, 0px))" : undefined,
          paddingBottom: isMobile && isMobileFullscreen ? "5rem" : undefined,
          ...(!isMobile ? { marginLeft: "var(--sidebar-width, 240px)" } : {}),
        }}
      >
        {showBanners && (
          <>
            <DemoBanner />
            <TrialBanner />
            <BillingBanner />
          </>
        )}

        {/* Offline indicator */}
        <div className="fixed bottom-4 right-4 z-50">
          <OfflineIndicator />
        </div>

        {isMobileFullscreen ? (
          <div className="h-full min-h-0 overflow-hidden">{children}</div>
        ) : !isMobile && desktopFullHeight ? (
          <div className="h-full min-h-0 overflow-hidden">{children}</div>
        ) : (
          <div className="max-w-[1360px] mx-auto py-6 px-6 lg:px-8 overflow-x-hidden">
            {children}
          </div>
        )}
      </main>

      {isPendingPayment && (
        <PaymentPendingOverlay pendingPlan={pendingPlan} onCancel={cancelPending} />
      )}
      
      <DemoTourOverlay />
      {!isMobile && !isSuppressed("info") && <InstallBanner />}
    </div>
  );
}
