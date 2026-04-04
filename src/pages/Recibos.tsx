import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useReceipts, type Receipt } from "@/hooks/useReceipts";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Receipt as ReceiptIcon, Search, Eye, Send, Edit2, X, Check, Loader2, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const statusLabels: Record<string, string> = {
  sent: "Enviado",
  draft: "Rascunho",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  sent: "bg-green-500/15 text-green-700 border-green-200",
  draft: "bg-yellow-500/15 text-yellow-700 border-yellow-200",
  cancelled: "bg-red-500/15 text-red-700 border-red-200",
};

export default function Recibos() {
  const { organizationId } = useAuth();
  const { receipts, isLoading, updateReceipt } = useReceipts();
  const [search, setSearch] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [editing, setEditing] = useState(false);
  const [editMessage, setEditMessage] = useState("");
  const [resending, setResending] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return receipts;
    const q = search.toLowerCase();
    return receipts.filter(
      (r) =>
        r.client_name.toLowerCase().includes(q) ||
        r.quote_number?.toLowerCase().includes(q) ||
        r.service_description?.toLowerCase().includes(q)
    );
  }, [receipts, search]);

  // Connected channels for resend
  const { data: connectedChannels } = useQuery({
    queryKey: ["connected-channels-receipts", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("whatsapp_channels")
        .select("id, name, phone_number")
        .eq("organization_id", organizationId)
        .eq("is_connected", true)
        .eq("channel_status", "connected")
        .in("channel_type", ["CUSTOMER_INBOX", "customer_inbox"]);
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 60_000,
  });

  const handleView = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setEditing(false);
    setEditMessage(receipt.message);
  };

  const handleSaveEdit = async () => {
    if (!selectedReceipt) return;
    await updateReceipt.mutateAsync({ id: selectedReceipt.id, message: editMessage });
    setSelectedReceipt({ ...selectedReceipt, message: editMessage });
    setEditing(false);
    toast.success("Recibo atualizado!");
  };

  const handleResend = async () => {
    if (!selectedReceipt?.client_phone) {
      toast.error("Cliente sem telefone cadastrado.");
      return;
    }
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-reminder", {
        body: {
          phone: selectedReceipt.client_phone,
          message: selectedReceipt.message,
          client_name: selectedReceipt.client_name,
        },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.message || "Erro ao reenviar recibo.");
        return;
      }
      toast.success("Recibo reenviado com sucesso! 🧾");
    } catch {
      toast.error("Erro ao reenviar recibo.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ReceiptIcon className="h-6 w-6 text-primary" />
          Recibos
        </h1>
        <p className="text-muted-foreground text-sm">
          {filtered.length} recibo{filtered.length !== 1 ? "s" : ""} emitido{filtered.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, OS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ReceiptIcon className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">Nenhum recibo encontrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Recibos são gerados automaticamente ao concluir serviços.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="hidden sm:table-cell">OS</TableHead>
                <TableHead className="hidden md:table-cell">Valor</TableHead>
                <TableHead className="hidden md:table-cell">Enviado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((receipt) => (
                <TableRow key={receipt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleView(receipt)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{receipt.client_name}</p>
                      <p className="text-xs text-muted-foreground sm:hidden">
                        {receipt.quote_number ? `OS #${receipt.quote_number}` : ""} · {formatCurrency(receipt.service_value)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {receipt.quote_number ? `#${receipt.quote_number}` : "-"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm font-medium">
                    {formatCurrency(receipt.service_value)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {receipt.sent_at ? formatDate(receipt.sent_at) : formatDate(receipt.created_at)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusColors[receipt.status] || ""}`}>
                      {statusLabels[receipt.status] || receipt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleView(receipt); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Receipt detail dialog */}
      <Dialog open={!!selectedReceipt} onOpenChange={(v) => !v && setSelectedReceipt(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ReceiptIcon className="h-4 w-4 text-primary" />
              Recibo — {selectedReceipt?.client_name}
            </DialogTitle>
          </DialogHeader>

          {selectedReceipt && (
            <div className="space-y-4">
              {/* Meta info */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">OS:</span>{" "}
                  <span className="font-medium">#{selectedReceipt.quote_number || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Valor:</span>{" "}
                  <span className="font-medium">{formatCurrency(selectedReceipt.service_value)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Enviado via:</span>{" "}
                  <span className="font-medium capitalize">{selectedReceipt.sent_via || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data:</span>{" "}
                  <span className="font-medium">
                    {selectedReceipt.sent_at ? formatDate(selectedReceipt.sent_at) : formatDate(selectedReceipt.created_at)}
                  </span>
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Mensagem do recibo:</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => { setEditing(!editing); setEditMessage(selectedReceipt.message); }}>
                    {editing ? <><X className="h-3 w-3" /> Cancelar</> : <><Edit2 className="h-3 w-3" /> Editar</>}
                  </Button>
                </div>
                {editing ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editMessage}
                      onChange={(e) => setEditMessage(e.target.value)}
                      className="text-xs min-h-[200px] resize-none font-mono"
                    />
                    <Button size="sm" className="gap-1" onClick={handleSaveEdit} disabled={updateReceipt.isPending}>
                      {updateReceipt.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      Salvar
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted/50 border border-border p-3 max-h-[300px] overflow-y-auto">
                    <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                      {selectedReceipt.message.replace(/\*/g, "")}
                    </p>
                  </div>
                )}
              </div>

              {/* Channel info */}
              {connectedChannels && connectedChannels.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Canal: <span className="font-medium text-foreground">{connectedChannels[0].name}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setSelectedReceipt(null)}>Fechar</Button>
            {selectedReceipt?.client_phone && (
              <Button size="sm" className="gap-1.5" onClick={handleResend} disabled={resending}>
                {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Reenviar via WhatsApp
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
