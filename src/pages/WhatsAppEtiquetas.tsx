import { AppLayout } from "@/components/layout";
import { TagsManager } from "@/components/whatsapp/TagsManager";

export default function WhatsAppEtiquetas() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-3xl mx-auto">
        <TagsManager open={true} onOpenChange={() => {}} embedded />
      </div>
    </AppLayout>
  );
}
