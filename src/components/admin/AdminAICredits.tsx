import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Plus, Save, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface OrgCredits {
  organization_id: string;
  org_name: string;
  balance: number;
}

interface CreditConfig {
  id: string;
  action_slug: string;
  credits_cost: number;
  label: string;
}

export function AdminAICredits() {
  const [orgCredits, setOrgCredits] = useState<OrgCredits[]>([]);
  const [configs, setConfigs] = useState<CreditConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgCredits | null>(null);
  const [addAmount, setAddAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchData = async () => {
    setLoading(true);

    // Fetch all org credits with org names
    const { data: credits } = await supabase
      .from("ai_credits")
      .select("organization_id, balance");

    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, name");

    const orgsMap = new Map((orgs || []).map((o: any) => [o.id, o.name]));

    const merged: OrgCredits[] = (credits || []).map((c: any) => ({
      organization_id: c.organization_id,
      org_name: orgsMap.get(c.organization_id) || "Desconhecida",
      balance: c.balance,
    }));

    merged.sort((a, b) => a.balance - b.balance);
    setOrgCredits(merged);

    // Fetch config
    const { data: configData } = await supabase
      .from("ai_credit_config")
      .select("*")
      .order("action_slug");

    setConfigs((configData || []) as CreditConfig[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCredits = async () => {
    if (!selectedOrg || !addAmount) return;
    const amount = parseInt(addAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc("add_ai_credits", {
      _org_id: selectedOrg.organization_id,
      _amount: amount,
      _action_type: "admin_grant",
      _description: `Créditos adicionados manualmente pelo admin`,
    });

    if (error) {
      toast.error("Erro ao adicionar créditos: " + error.message);
    } else {
      toast.success(`${amount} créditos adicionados para ${selectedOrg.org_name}`);
      setShowAddDialog(false);
      setAddAmount("");
      setSelectedOrg(null);
      fetchData();
    }
    setSaving(false);
  };

  const handleSaveConfig = async (config: CreditConfig, newCost: number) => {
    setSavingConfig(true);
    const { error } = await supabase
      .from("ai_credit_config")
      .update({ credits_cost: newCost, updated_at: new Date().toISOString() })
      .eq("id", config.id);

    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success(`Custo de "${config.label}" atualizado para ${newCost} créditos`);
      fetchData();
    }
    setSavingConfig(false);
  };

  const filtered = orgCredits.filter(
    (o) =>
      o.org_name.toLowerCase().includes(search.toLowerCase()) ||
      o.organization_id.includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Credit Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Configuração de Custos por Ação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {configs.map((config) => (
            <ConfigRow
              key={config.id}
              config={config}
              onSave={handleSaveConfig}
              saving={savingConfig}
            />
          ))}
        </CardContent>
      </Card>

      {/* Org Credits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Créditos por Organização ({orgCredits.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar organização..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-1.5">
            {filtered.map((org) => (
              <div
                key={org.organization_id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{org.org_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{org.organization_id.slice(0, 8)}…</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={org.balance <= 0 ? "destructive" : org.balance <= 20 ? "secondary" : "default"}
                    className="text-xs"
                  >
                    {org.balance} créditos
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setSelectedOrg(org);
                      setShowAddDialog(true);
                    }}
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Add Credits Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Adicionar Créditos</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Organização: <span className="font-medium text-foreground">{selectedOrg?.org_name}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Saldo atual: <span className="font-medium text-foreground">{selectedOrg?.balance} créditos</span>
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantidade de créditos</Label>
              <Input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="Ex: 100"
                min="1"
              />
            </div>
            <Button className="w-full" onClick={handleAddCredits} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Adicionar Créditos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConfigRow({
  config,
  onSave,
  saving,
}: {
  config: CreditConfig;
  onSave: (config: CreditConfig, newCost: number) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState(String(config.credits_cost));
  const changed = parseInt(value, 10) !== config.credits_cost;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{config.label}</p>
        <p className="text-[10px] text-muted-foreground font-mono">{config.action_slug}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-20 h-8 text-sm text-center"
          min="1"
        />
        <span className="text-xs text-muted-foreground">créditos</span>
        {changed && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onSave(config, parseInt(value, 10))}
            disabled={saving}
          >
            <Save className="h-3 w-3" /> Salvar
          </Button>
        )}
      </div>
    </div>
  );
}
