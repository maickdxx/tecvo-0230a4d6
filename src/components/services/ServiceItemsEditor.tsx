import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useServiceItems, type ServiceItem } from "@/hooks/useServiceItems";
import { useCatalogServices } from "@/hooks/useCatalogServices";

interface ServiceItemsEditorProps {
  serviceId: string;
}

export function ServiceItemsEditor({ serviceId }: ServiceItemsEditorProps) {
  const { items, total, create, remove, isCreating, isDeleting } = useServiceItems(serviceId);
  const { activeServices } = useCatalogServices();
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "1",
    unit_price: "",
    discount: "0",
  });

  const handleSelectFromCatalog = (serviceId: string) => {
    if (serviceId === "manual") {
      setNewItem({ description: "", quantity: "1", unit_price: "", discount: "0" });
      return;
    }
    const service = activeServices.find((s) => s.id === serviceId);
    if (service) {
      setNewItem({
        description: service.name,
        quantity: "1",
        unit_price: service.unit_price.toString(),
        discount: service.default_discount?.toString() || "0",
      });
    }
  };

  const handleAddItem = async () => {
    if (!newItem.description || !newItem.unit_price) return;

    await create({
      description: newItem.description,
      quantity: parseFloat(newItem.quantity) || 1,
      unit_price: parseFloat(newItem.unit_price) || 0,
    });

    setNewItem({ description: "", quantity: "1", unit_price: "", discount: "0" });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const calculateSubtotal = () => {
    const qty = parseFloat(newItem.quantity) || 0;
    const price = parseFloat(newItem.unit_price) || 0;
    const discount = parseFloat(newItem.discount) || 0;
    const subtotal = qty * price;
    return subtotal - (subtotal * discount) / 100;
  };

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
                <TableHead className="w-28 text-right">Total</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: ServiceItem) => (
                <TableRow key={item.id}>
                  <TableCell>{item.name || item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unit_price)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => remove(item.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50">
                <TableCell colSpan={3} className="font-semibold text-right">
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

      <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="catalog-select" className="text-xs">
              Selecionar do Catálogo
            </Label>
            <Select onValueChange={handleSelectFromCatalog}>
              <SelectTrigger id="catalog-select">
                <SelectValue placeholder="Escolher serviço..." />
              </SelectTrigger>
              <SelectContent className="max-h-[60vh] overflow-y-auto">
                <SelectItem value="manual">Digitar manualmente</SelectItem>
                {activeServices.map((service) => (
                  <SelectItem key={service.id} value={service.id} className="py-3 whitespace-normal break-words text-sm leading-snug">
                    {service.name} - {formatCurrency(service.unit_price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-desc" className="text-xs">
              Descrição *
            </Label>
            <Input
              id="item-desc"
              placeholder="Ex: Instalação de Split"
              value={newItem.description}
              onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
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
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-discount" className="text-xs">
              Desconto (%)
            </Label>
            <Input
              id="item-discount"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              value={newItem.discount}
              onChange={(e) => setNewItem({ ...newItem, discount: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
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
          variant={newItem.description && newItem.unit_price ? "default" : "outline"}
          className={cn(
            "w-full gap-2 transition-all duration-200",
            newItem.description && newItem.unit_price ? "bg-primary text-primary-foreground shadow-md hover:scale-[1.01]" : ""
          )}
          onClick={handleAddItem}
          disabled={isCreating || !newItem.unit_price}
        >
          <Plus className="h-4 w-4" />
          Adicionar Serviço
        </Button>
      </div>
    </div>
  );
}
