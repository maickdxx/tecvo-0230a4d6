import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Clock, ListChecks } from "lucide-react";
import type { CatalogService, CatalogServiceFormData } from "@/hooks/useCatalogServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { Badge } from "@/components/ui/badge";

interface CatalogServiceFormProps {
  service?: CatalogService | null;
  onSubmit: (data: CatalogServiceFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CatalogServiceForm({
  service,
  onSubmit,
  onCancel,
  isLoading,
}: CatalogServiceFormProps) {
  const { serviceTypes } = useServiceTypes();
  const [formData, setFormData] = useState<CatalogServiceFormData>({
    name: "",
    description: "",
    unit_price: 0,
    default_discount: 0,
    notes: "",
    is_active: true,
    service_type: "",
    category: "",
    estimated_duration: "01:00",
    standard_checklist: [],
  });

  const [newChecklistItem, setNewChecklistItem] = useState("");

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name,
        description: service.description || "",
        unit_price: service.unit_price,
        default_discount: service.default_discount || 0,
        notes: service.notes || "",
        is_active: service.is_active,
        service_type: service.service_type || "",
        category: service.category || "",
        estimated_duration: service.estimated_duration || "01:00",
        standard_checklist: service.standard_checklist || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        unit_price: 0,
        default_discount: 0,
        notes: "",
        is_active: true,
        service_type: "",
        category: "",
        estimated_duration: "01:00",
        standard_checklist: [],
      });
      setNewChecklistItem("");
    }
  }, [service]);

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setFormData(prev => ({
      ...prev,
      standard_checklist: [...(prev.standard_checklist || []), newChecklistItem.trim()]
    }));
    setNewChecklistItem("");
  };

  const removeChecklistItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      standard_checklist: (prev.standard_checklist || []).filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome do Serviço *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Ex: Instalação de Ar Condicionado"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="service_type">Tipo de Serviço *</Label>
        <Select
          value={formData.service_type || ""}
          onValueChange={(value) => setFormData({ ...formData, service_type: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo..." />
          </SelectTrigger>
          <SelectContent>
            {serviceTypes.map((type) => (
              <SelectItem key={type.slug} value={type.slug}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="category" className="flex items-center gap-2">
          Categoria
        </Label>
        <Input
          id="category"
          value={formData.category}
          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          placeholder="Ex: Ar Condicionado"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="estimated_duration" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Duração Estimada
        </Label>
        <Input
          id="estimated_duration"
          value={formData.estimated_duration}
          onChange={(e) => setFormData({ ...formData, estimated_duration: e.target.value })}
          placeholder="Ex: 01:30 ou 2h"
        />
        <p className="text-xs text-muted-foreground">Formato: HH:MM (ex: 01:30 = 1h30min)</p>
      </div>

        <Label htmlFor="description">Descrição Detalhada</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Descreva detalhadamente o serviço..."
          rows={3}
        />
      </div>

      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
        <Label className="flex items-center gap-2">
          <ListChecks className="h-4 w-4" />
          Checklist Padrão
        </Label>
        <div className="flex gap-2">
          <Input
            value={newChecklistItem}
            onChange={(e) => setNewChecklistItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addChecklistItem();
              }
            }}
            placeholder="Adicionar item ao checklist..."
          />
          <Button type="button" size="icon" variant="outline" onClick={addChecklistItem}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-2 mt-2">
          {formData.standard_checklist?.map((item, index) => (
            <div key={index} className="flex items-center justify-between gap-2 bg-background p-2 rounded border">
              <span className="text-sm">{item}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={() => removeChecklistItem(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {(!formData.standard_checklist || formData.standard_checklist.length === 0) && (
            <p className="text-xs text-muted-foreground italic">Nenhum item adicionado ao checklist.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="unit_price">Valor Unitário (R$) *</Label>
          <Input
            id="unit_price"
            type="number"
            min="0"
            step="0.01"
            value={formData.unit_price}
            onChange={(e) =>
              setFormData({ ...formData, unit_price: parseFloat(e.target.value) || 0 })
            }
            placeholder="0,00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="default_discount">Desconto Padrão (%)</Label>
          <Input
            id="default_discount"
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={formData.default_discount}
            onChange={(e) =>
              setFormData({
                ...formData,
                default_discount: parseFloat(e.target.value) || 0,
              })
            }
            placeholder="0"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações Internas</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Notas internas (não aparece no orçamento)..."
          rows={2}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label htmlFor="is_active" className="font-medium">
            Serviço Ativo
          </Label>
          <p className="text-xs text-muted-foreground">
            Serviços inativos não aparecem na seleção
          </p>
        </div>
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading || !formData.name || !formData.service_type} className="flex-1">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : service ? (
            "Salvar Alterações"
          ) : (
            "Cadastrar Serviço"
          )}
        </Button>
      </div>
    </form>
  );
}
