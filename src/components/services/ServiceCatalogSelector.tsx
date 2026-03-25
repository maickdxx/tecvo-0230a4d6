import { useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCatalogServices, type CatalogService } from "@/hooks/useCatalogServices";
import { cn } from "@/lib/utils";

export interface ServiceItemLocal {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  discount_type: "percentage" | "fixed";
  catalog_service_type?: string;
  catalog_service_id?: string;
  is_non_standard?: boolean;
  category?: string;
  estimated_duration?: string;
  standard_checklist?: any;
}

interface ServiceCatalogSelectorProps {
  items: ServiceItemLocal[];
  onItemsChange: (items: ServiceItemLocal[]) => void;
  disabled?: boolean;
  onServiceTypeDetected?: (serviceType: string) => void;
}

export function ServiceCatalogSelector({
  items,
  onItemsChange,
  disabled = false,
  onServiceTypeDetected,
}: ServiceCatalogSelectorProps) {
  const { activeServices, isLoading } = useCatalogServices();
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    quantity: "1",
    unit_price: "",
    discount: "0",
    discount_type: "percentage" as "percentage" | "fixed",
    estimated_duration: "",
  });

  const [selectedCatalogServiceId, setSelectedCatalogServiceId] = useState<string | null>(null);
  const [selectedCatalogServiceType, setSelectedCatalogServiceType] = useState<string | null>(null);

  const handleSelectFromCatalog = (serviceId: string) => {
    if (serviceId === "manual") {
      setNewItem({ 
        name: "", 
        description: "", 
        quantity: "1", 
        unit_price: "", 
        discount: "0", 
        discount_type: "percentage",
        estimated_duration: "",
      });
      setSelectedCatalogServiceType(null);
      setSelectedCatalogServiceId(null);
      return;
    }
    const service = activeServices.find((s) => s.id === serviceId);
    if (service) {
      setNewItem({
        name: service.name,
        description: service.description || "",
        quantity: "1",
        unit_price: service.unit_price.toString(),
        discount: service.default_discount?.toString() || "0",
        discount_type: "percentage",
        estimated_duration: service.estimated_duration || "",
      });
      setSelectedCatalogServiceType(service.service_type);
      setSelectedCatalogServiceId(service.id);
      onServiceTypeDetected?.(service.service_type || "");
    }
  };

  const handleAddItem = () => {
    if (!newItem.name || !newItem.unit_price) return;

    const newItemData: ServiceItemLocal = {
      id: crypto.randomUUID(),
      name: newItem.name,
      description: newItem.description || newItem.name,
      quantity: parseFloat(newItem.quantity) || 1,
      unit_price: parseFloat(newItem.unit_price) || 0,
      discount: parseFloat(newItem.discount) || 0,
      discount_type: newItem.discount_type,
      catalog_service_type: selectedCatalogServiceType || undefined,
      catalog_service_id: selectedCatalogServiceId || undefined,
      is_non_standard: !selectedCatalogServiceId,
      estimated_duration: newItem.estimated_duration || undefined,
      category: selectedCatalogServiceType || undefined,
      standard_checklist: selectedCatalogServiceId 
        ? activeServices.find(s => s.id === selectedCatalogServiceId)?.standard_checklist 
        : undefined,
    };

    onItemsChange([...items, newItemData]);
    setNewItem({ 
      name: "", 
      description: "", 
      quantity: "1", 
      unit_price: "", 
      discount: "0", 
      discount_type: "percentage",
      estimated_duration: "",
    });
    setSelectedCatalogServiceType(null);
    setSelectedCatalogServiceId(null);
  };

  const saveToCatalog = async (item: ServiceItemLocal) => {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from("catalog_services")
        .insert({
          name: item.name,
          description: item.description,
          unit_price: item.unit_price,
          organization_id: organizationId,
          service_type: item.catalog_service_type || "other",
          estimated_duration: item.estimated_duration,
          category: item.category,
          standard_checklist: item.standard_checklist,
          is_active: true,
        });

      if (error) throw error;

      // Update the item in the list to be linked to the new catalog service
      const updatedItems = items.map(i =>
        i.id === item.id ? { ...i, is_non_standard: false } : i
      );
      onItemsChange(updatedItems);

      queryClient.invalidateQueries({ queryKey: ["catalog-services"] });

      toast({
        title: "Salvo no catálogo",
        description: `O serviço "${item.description}" foi adicionado ao seu catálogo.`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao salvar no catálogo",
        description: (error as Error).message,
      });
    }
  };

  const handleRemoveItem = (id: string) => {
    onItemsChange(items.filter((item) => item.id !== id));
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const calculateItemTotal = (item: ServiceItemLocal) => {
    const subtotal = item.quantity * item.unit_price;
    if (item.discount_type === "fixed") {
      return Math.max(0, subtotal - item.discount);
    }
    return subtotal - (subtotal * item.discount) / 100;
  };

  const calculateSubtotal = () => {
    const qty = parseFloat(newItem.quantity) || 0;
    const price = parseFloat(newItem.unit_price) || 0;
    const discount = parseFloat(newItem.discount) || 0;
    const subtotal = qty * price;
    if (newItem.discount_type === "fixed") {
      return Math.max(0, subtotal - discount);
    }
    return subtotal - (subtotal * discount) / 100;
  };

  const formatDiscount = (item: ServiceItemLocal) => {
    if (item.discount === 0) return "-";
    if (item.discount_type === "fixed") {
      return formatCurrency(item.discount);
    }
    return `${item.discount}%`;
  };

  const total = items.reduce((acc, item) => acc + calculateItemTotal(item), 0);

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Serviços / Mão de Obra</Label>

      {items.length > 0 && (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-20 text-center">Qtd</TableHead>
                <TableHead className="w-28 text-right">Unitário</TableHead>
                <TableHead className="w-20 text-center">Desc%</TableHead>
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.description}</span>
                      {item.is_non_standard && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] h-4 border-amber-500 text-amber-600 bg-amber-50 gap-1 font-normal">
                            <AlertCircle className="h-3 w-3" />
                            Serviço não padronizado
                          </Badge>
                          {!disabled && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 px-1.5 text-[10px] text-primary hover:bg-primary/10 gap-1"
                              onClick={() => saveToCatalog(item)}
                            >
                              <Save className="h-3 w-3" />
                              Adicionar ao Catálogo
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatDiscount(item)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(calculateItemTotal(item))}
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={disabled}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={4} className="font-semibold text-right">
                  Total:
                </TableCell>
                <TableCell className="font-bold text-right">
                  {formatCurrency(total)}
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {!disabled && (
        <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label htmlFor="catalog-select" className="text-xs">
                Selecionar do Catálogo
              </Label>
              <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={catalogOpen}
                    className="w-full justify-between font-normal"
                    disabled={isLoading}
                  >
                    Escolher serviço...
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar serviço..." />
                    <CommandList>
                      <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="digitar-manualmente"
                          onSelect={() => {
                            handleSelectFromCatalog("manual");
                            setCatalogOpen(false);
                          }}
                          className="text-primary font-medium"
                        >
                          Digitar manualmente
                        </CommandItem>
                        {activeServices.map((service) => (
                          <CommandItem
                            key={service.id}
                            value={`${service.name} ${formatCurrency(service.unit_price)}`}
                            onSelect={() => {
                              handleSelectFromCatalog(service.id);
                              setCatalogOpen(false);
                            }}
                          >
                            {service.name} - {formatCurrency(service.unit_price)}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="item-name" className="text-xs">
                  Nome do Serviço *
                </Label>
                <Input
                  id="item-name"
                  placeholder="Ex: Instalação de Split"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="item-duration" className="text-xs">
                  Tempo Estimado (ex: 01:30)
                </Label>
                <Input
                  id="item-duration"
                  placeholder="00:00"
                  value={newItem.estimated_duration}
                  onChange={(e) => setNewItem({ ...newItem, estimated_duration: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="item-desc" className="text-xs">
                Descrição Detalhada
              </Label>
              <Input
                id="item-desc"
                placeholder="Detalhes adicionais do serviço..."
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="item-qty" className="text-xs">
                Qtd *
              </Label>
              <Input
                id="item-qty"
                type="number"
                min="0.01"
                step="0.01"
                value={newItem.quantity}
                onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-price" className="text-xs">
                Valor (R$) *
              </Label>
              <Input
                id="item-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={newItem.unit_price}
                onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="item-discount" className="text-xs">
                Desconto
              </Label>
              <div className="flex gap-1">
                <ToggleGroup
                  type="single"
                  value={newItem.discount_type}
                  onValueChange={(val) => {
                    if (val) setNewItem({ ...newItem, discount_type: val as "percentage" | "fixed" });
                  }}
                  className="shrink-0"
                >
                  <ToggleGroupItem value="percentage" size="sm" className="h-10 px-2 text-xs">
                    %
                  </ToggleGroupItem>
                  <ToggleGroupItem value="fixed" size="sm" className="h-10 px-2 text-xs">
                    R$
                  </ToggleGroupItem>
                </ToggleGroup>
                <Input
                  id="item-discount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={newItem.discount}
                  onChange={(e) => setNewItem({ ...newItem, discount: e.target.value })}
                  className="flex-1 min-w-0"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Subtotal</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm font-medium">
                {formatCurrency(calculateSubtotal())}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleAddItem}
            disabled={!newItem.description || !newItem.unit_price}
          >
            <Plus className="h-4 w-4" />
            Adicionar Serviço
          </Button>
        </div>
      )}
    </div>
  );
}
