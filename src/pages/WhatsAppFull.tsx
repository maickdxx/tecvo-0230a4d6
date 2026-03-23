import { WhatsAppInbox } from "@/components/whatsapp/WhatsAppInbox";

export default function WhatsAppFull() {
  return (
    <div className="h-screen w-screen flex flex-col bg-background overflow-hidden">
      <WhatsAppInbox fullscreen />
    </div>
  );
}
