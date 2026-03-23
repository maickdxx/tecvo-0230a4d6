import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { getDefaultCatalogServices } from "@/lib/defaultCatalogServices";
import { useOrganization } from "@/hooks/useOrganization";

interface ImportCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportCatalogDialog({ open, onOpenChange }: ImportCatalogDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();
  const { organization } = useOrganization();
  const defaultServices = getDefaultCatalogServices();

  const handleImport = async () => {
    if (!organization?.id) return;

    setIsImporting(true);
    try {
      // Fetch existing services
      const { data: existing, error: fetchError } = await supabase
        .from("catalog_services")
        .select("name")
        .eq("organization_id", organization.id)
        .is("deleted_at", null);

      if (fetchError) throw fetchError;

      const existingNames = new Set(
        (existing || []).map((s) => s.name.toLowerCase().trim())
      );

      const toImport = defaultServices
        .filter((s) => !existingNames.has(s.name.toLowerCase().trim()))
        .map((s) => ({
          name: s.name,
          unit_price: s.unit_price,
          description: s.description || null,
          notes: "catalogo_padrao",
          service_type: s.service_type,
          organization_id: organization.id,
        }));

      if (toImport.length === 0) {
        toast({
          title: "Catálogo já importado",
          description: "Todos os serviços padrão já existem no seu catálogo.",
        });
        onOpenChange(false);
        return;
      }

      const { error: insertError } = await supabase
        .from("catalog_services")
        .insert(toImport);

      if (insertError) throw insertError;

      await queryClient.invalidateQueries({ queryKey: ["catalog-services"] });

      toast({
        title: "Serviços importados!",
        description: `${toImport.length} serviço(s) foram adicionados ao seu catálogo.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao importar",
        description: "Não foi possível importar os serviços. Tente novamente.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Importar catálogo padrão de ar-condicionado</AlertDialogTitle>
          <AlertDialogDescription>
            Serão adicionados até 14 serviços padrão de climatização já com preço sugerido.
            Serviços com nome idêntico aos seus não serão duplicados.
            Você poderá alterar depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isImporting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleImport} disabled={isImporting}>
            {isImporting ? "Importando..." : "Importar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
