import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Ticket,
  Plus,
  Trash2,
  Copy,
  Loader2,
  Percent,
  Sparkles,
  Gift,
} from "lucide-react";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  coupon_type: string;
  discount_percent: number;
  ai_credits_amount: number;
  stripe_coupon_id: string | null;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  applicable_plans: string[];
  created_at: string;
}

const COUPON_TYPE_LABELS: Record<string, string> = {
  discount: "Desconto",
  ai_credits: "Créditos IA",
  both: "Desconto + Créditos IA",
};

const COUPON_TYPE_ICONS: Record<string, typeof Percent> = {
  discount: Percent,
  ai_credits: Sparkles,
  both: Gift,
};

export function AdminCoupons() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    description: "",
    coupon_type: "discount",
    discount_percent: 0,
    ai_credits_amount: 0,
    max_uses: "",
    valid_until: "",
    applicable_plans: ["starter", "essential", "pro"],
  });

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });

  const createCoupon = useMutation({
    mutationFn: async () => {
      const code = formData.code.toUpperCase().trim();
      if (!code) throw new Error("Código é obrigatório");

      const insertData: any = {
        code,
        description: formData.description || null,
        coupon_type: formData.coupon_type,
        discount_percent: formData.coupon_type !== "ai_credits" ? formData.discount_percent : 0,
        ai_credits_amount: formData.coupon_type !== "discount" ? formData.ai_credits_amount : 0,
        max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
        valid_until: formData.valid_until || null,
        applicable_plans: formData.applicable_plans,
      };

      // If discount coupon, create Stripe coupon too
      if (formData.coupon_type !== "ai_credits" && formData.discount_percent > 0) {
        const { data: stripeData, error: stripeError } = await supabase.functions.invoke(
          "coupon-create-stripe",
          {
            body: {
              name: code,
              percent_off: formData.discount_percent,
            },
          }
        );
        if (stripeError) throw stripeError;
        if (stripeData?.coupon_id) {
          insertData.stripe_coupon_id = stripeData.coupon_id;
        }
      }

      const { error } = await supabase.from("coupons").insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      setDialogOpen(false);
      resetForm();
      toast({ title: "Cupom criado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao criar cupom", description: err.message });
    },
  });

  const toggleCoupon = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
  });

  const deleteCoupon = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast({ title: "Cupom excluído" });
    },
  });

  const resetForm = () => {
    setFormData({
      code: "",
      description: "",
      coupon_type: "discount",
      discount_percent: 0,
      ai_credits_amount: 0,
      max_uses: "",
      valid_until: "",
      applicable_plans: ["starter", "essential", "pro"],
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ticket className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-bold">Cupons de Desconto</h2>
          <Badge variant="secondary">{coupons.length}</Badge>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Novo Cupom
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum cupom criado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {coupons.map((coupon) => {
            const Icon = COUPON_TYPE_ICONS[coupon.coupon_type] || Ticket;
            const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
            return (
              <Card key={coupon.id} className={!coupon.is_active || isExpired ? "opacity-60" : ""}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">{coupon.code}</span>
                        <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                          <Copy className="h-3 w-3" />
                        </button>
                        <Badge variant={coupon.is_active && !isExpired ? "default" : "secondary"} className="text-[10px]">
                          {isExpired ? "Expirado" : coupon.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{COUPON_TYPE_LABELS[coupon.coupon_type]}</span>
                        {coupon.discount_percent > 0 && <span>• {coupon.discount_percent}% off</span>}
                        {coupon.ai_credits_amount > 0 && <span>• +{coupon.ai_credits_amount} créditos IA</span>}
                        <span>• {coupon.times_used}{coupon.max_uses ? `/${coupon.max_uses}` : ""} usos</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={coupon.is_active}
                      onCheckedChange={(checked) =>
                        toggleCoupon.mutate({ id: coupon.id, is_active: checked })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        if (confirm("Excluir este cupom?")) deleteCoupon.mutate(coupon.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Coupon Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cupom</DialogTitle>
            <DialogDescription>Crie um cupom de desconto ou créditos IA</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Código do cupom</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="EX: BEMVINDO20"
                className="font-mono"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Desconto de boas-vindas"
              />
            </div>

            <div>
              <Label>Tipo do cupom</Label>
              <Select
                value={formData.coupon_type}
                onValueChange={(v) => setFormData({ ...formData, coupon_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">Desconto no plano</SelectItem>
                  <SelectItem value="ai_credits">Créditos de IA</SelectItem>
                  <SelectItem value="both">Desconto + Créditos IA</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.coupon_type !== "ai_credits" && (
              <div>
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formData.discount_percent}
                  onChange={(e) =>
                    setFormData({ ...formData, discount_percent: Number(e.target.value) })
                  }
                />
              </div>
            )}

            {formData.coupon_type !== "discount" && (
              <div>
                <Label>Créditos de IA</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.ai_credits_amount}
                  onChange={(e) =>
                    setFormData({ ...formData, ai_credits_amount: Number(e.target.value) })
                  }
                />
              </div>
            )}

            <div>
              <Label>Limite de usos (vazio = ilimitado)</Label>
              <Input
                type="number"
                min={1}
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                placeholder="Ilimitado"
              />
            </div>

            <div>
              <Label>Válido até (opcional)</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>

            <Button
              className="w-full"
              onClick={() => createCoupon.mutate()}
              disabled={createCoupon.isPending || !formData.code.trim()}
            >
              {createCoupon.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Criar Cupom
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
