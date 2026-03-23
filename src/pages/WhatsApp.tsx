import { AppLayout } from "@/components/layout";
import { WhatsAppInbox } from "@/components/whatsapp/WhatsAppInbox";

export default function WhatsApp() {
  return (
    <AppLayout mobileFullscreen hideBannersOnMobileFullscreen desktopFullHeight>
      <WhatsAppInbox />
    </AppLayout>
  );
}
