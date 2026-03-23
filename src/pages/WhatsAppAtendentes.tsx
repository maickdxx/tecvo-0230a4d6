import { AppLayout } from "@/components/layout";
import { AtendentesDialog } from "@/components/whatsapp/AtendentesPanel";

export default function WhatsAppAtendentes() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <AtendentesDialog open={true} onOpenChange={() => {}} embedded />
      </div>
    </AppLayout>
  );
}
