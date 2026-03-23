import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { SupplierList } from "@/components/suppliers";

export default function Fornecedores() {
  return (
    <AppLayout>
      <PageTutorialBanner pageKey="fornecedores" title="Fornecedores" message="Organize seus fornecedores e tenha controle sobre custos e parcerias." />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fornecedores</h1>
          <p className="text-muted-foreground">
            Gerencie seus fornecedores e parceiros
          </p>
        </div>

        <SupplierList />
      </div>
    </AppLayout>
  );
}
