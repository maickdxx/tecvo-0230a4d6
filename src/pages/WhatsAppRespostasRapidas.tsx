import { AppLayout } from "@/components/layout";
import { QuickRepliesManager } from "@/components/whatsapp/QuickRepliesManager";

export default function WhatsAppRespostasRapidas() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <QuickRepliesManager open={true} onOpenChange={() => {}} embedded />
      </div>
    </AppLayout>
  );
}
