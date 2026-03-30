import { useState } from "react";
import { format } from "date-fns";
import { FileText, Plus, X, MessageCircle, Download, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { useServiceItems } from "@/hooks/useServiceItems";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { generateQuotePDF } from "@/lib/generateQuotePDF";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Service } from "@/hooks/useServices";

interface QuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}

export function QuoteDialog({ open, onOpenChange, service }: QuoteDialogProps) {
  const { profile } = useAuth();
  const { isFreePlan } = useSubscription();
  const { items, total, create, remove, isCreating } = useServiceItems(service.id);
  
  const [paymentConditions, setPaymentConditions] = useState(
    service.payment_conditions || ""
  );
  const [validityDays, setValidityDays] = useState(
    service.quote_validity_days?.toString() || "30"
  );
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "1",
    unit_price: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleAddItem = async () => {
    if (!newItem.description || !newItem.unit_price) return;

    await create({
      description: newItem.description,
      quantity: parseFloat(newItem.quantity) || 1,
      unit_price: parseFloat(newItem.unit_price) || 0,
    });

    setNewItem({ description: "", quantity: "1", unit_price: "" });
  };

  const handleSaveAndDownload = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("services")
        .update({
          payment_conditions: paymentConditions,
          quote_validity_days: parseInt(validityDays) || 30,
          value: total > 0 ? total : service.value,
        })
        .eq("id", service.id);

      if (error) throw error;

      const { data: org } = await supabase
        .from("organizations")
        .select("name, cnpj_cpf, phone, email, address, city, state, logo_url, website, zip_code, signature_url, auto_signature_os")
        .eq("id", profile?.organization_id)
        .single();

      await generateQuotePDF({
        service: {
          ...service,
          payment_conditions: paymentConditions,
          quote_validity_days: parseInt(validityDays) || 30,
          value: total > 0 ? total : service.value,
        },
        items,
        organizationName: org?.name || "Minha Empresa",
        organizationCnpj: org?.cnpj_cpf || undefined,
        organizationPhone: org?.phone || undefined,
        organizationEmail: org?.email || undefined,
        organizationAddress: org?.address || undefined,
        organizationLogo: org?.logo_url || undefined,
        organizationWebsite: org?.website || undefined,
        organizationZipCode: org?.zip_code || undefined,
        organizationCity: org?.city || undefined,
        organizationState: org?.state || undefined,
        organizationSignature: org?.signature_url || undefined,
        autoSignatureOS: org?.auto_signature_os ?? false,
        isFreePlan,
      });

      toast({
        title: "Orçamento gerado!",
        description: "O PDF foi baixado com sucesso",
      });

      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar orçamento",
        description: (error as Error).message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const displayTotal = total > 0 ? total : (service.value || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Premium Header */}
        <div className="bg-muted/30 border-b border-border/40 px-6 pt-6 pb-4">
          <DialogHeader className="p-0 mb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base">
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                Orçamento
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-mono">
                <Hash className="h-3 w-3 mr-1" />
                {service.quote_number?.toString().padStart(4, "0")}
              </Badge>
            </div>
          </DialogHeader>
          
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Cliente: <span className="font-medium text-foreground">{service.client?.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "dd/MM/yyyy")}
            </p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Items */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Itens do Orçamento</Label>

            {items.length > 0 && (
              <div className="rounded-xl border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="text-xs font-semibold">Descrição</TableHead>
                      <TableHead className="w-16 text-center text-xs font-semibold">Qtd</TableHead>
                      <TableHead className="w-24 text-right text-xs font-semibold">Unitário</TableHead>
                      <TableHead className="w-24 text-right text-xs font-semibold">Total</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">
                          <p>{item.name || item.description}</p>
                          {item.name && item.description && item.name !== item.description && (
                            <p className="text-[10px] text-muted-foreground italic font-normal">{item.description}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatCurrency(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => remove(item.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-primary/5">
                      <TableCell colSpan={3} className="text-sm font-semibold">Total</TableCell>
                      <TableCell className="text-right text-base font-bold text-primary">
                        {formatCurrency(displayTotal)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}

            {/* Add item form */}
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Descrição</Label>
                <Input
                  placeholder="Ex: Mão de obra, Material"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  className="rounded-lg"
                />
              </div>
              <div className="w-16 space-y-1">
                <Label className="text-xs text-muted-foreground">Qtd</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={newItem.quantity}
                  onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  className="rounded-lg"
                />
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs text-muted-foreground">Valor</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={newItem.unit_price}
                  onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
                  className="rounded-lg"
                />
              </div>
              <Button
                type="button"
                size="icon"
                onClick={handleAddItem}
                disabled={isCreating || !newItem.unit_price}
                className="rounded-lg"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Empty state total */}
            {items.length === 0 && displayTotal > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Valor Total</span>
                <span className="text-xl font-bold text-primary">{formatCurrency(displayTotal)}</span>
              </div>
            )}
          </div>

          {/* Payment conditions */}
          <div className="space-y-2">
            <Label htmlFor="payment" className="text-sm font-semibold">Condições de Pagamento</Label>
            <Textarea
              id="payment"
              placeholder="Ex: 50% na aprovação, 50% na conclusão. Aceitamos PIX, cartão e boleto."
              value={paymentConditions}
              onChange={(e) => setPaymentConditions(e.target.value)}
              rows={3}
              className="rounded-lg"
            />
          </div>

          {/* Validity */}
          <div className="space-y-2">
            <Label htmlFor="validity" className="text-sm font-semibold">Validade do Orçamento (dias)</Label>
            <Input
              id="validity"
              type="number"
              min="1"
              value={validityDays}
              onChange={(e) => setValidityDays(e.target.value)}
              className="w-32 rounded-lg"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button onClick={handleSaveAndDownload} disabled={isSaving} className="flex-1 gap-2 rounded-xl shadow-sm">
              <Download className="h-4 w-4" />
              {isSaving ? "Gerando..." : "Baixar PDF"}
            </Button>
            <Button 
              variant="outline" 
              onClick={async () => {
                await handleSaveAndDownload();
                const formattedValue = formatCurrency(displayTotal);

                const message = `*Orçamento #${service.quote_number?.toString().padStart(4, "0")}*
Cliente: ${service.client?.name || ""}
Data: ${format(new Date(), "dd/MM/yyyy")}
Valor: ${formattedValue}

_PDF do orçamento em anexo_`.trim();

                const phoneNumber = service.client?.phone?.replace(/\D/g, "") || "";
                window.open(`https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
              }} 
              disabled={isSaving} 
              className="flex-1 gap-2 rounded-xl"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}