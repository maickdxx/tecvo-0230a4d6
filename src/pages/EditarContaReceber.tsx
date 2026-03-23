import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { ReceivableFullForm } from "@/components/finance/ReceivableFullForm";
import { useAccounts, type AccountFormData } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Loader2, RotateCcw, Copy, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import type { Account } from "@/hooks/useAccounts";

export default function EditarContaReceber() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { update, isUpdating, remove, isDeleting, create } = useAccounts({ accountType: "receivable" });
  const { user, organizationId } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("transactions")
      .select(`*, supplier:suppliers(id, name), client:clients(id, name), service:services(id, service_type, quote_number)`)
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setAccount(data as Account);
        setLoading(false);
      });
  }, [id]);

  const handleSubmit = async (data: AccountFormData) => {
    if (!id || !account) return;
    const previousStatus = account.status;
    const newStatus = data.status;

    await update({ id, data, previousStatus });

    if (previousStatus !== newStatus && user?.id && organizationId) {
      await supabase.from("transaction_status_log" as any).insert({
        transaction_id: id,
        organization_id: organizationId,
        changed_by: user.id,
        previous_status: previousStatus,
        new_status: newStatus,
      });
    }

    navigate("/contas-receber");
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await remove(id);
      toast({ title: "Conta excluída", description: "A conta a receber foi removida com sucesso." });
      navigate("/contas-receber");
    } catch {
      toast({ variant: "destructive", title: "Erro ao excluir", description: "Não foi possível excluir a conta." });
    }
  };

  const handleRestore = async () => {
    if (!id || !account) return;
    try {
      await update({ id, data: { status: "pending" }, previousStatus: account.status });
      toast({ title: "Conta restaurada", description: "O status foi alterado para pendente." });
      navigate("/contas-receber");
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível restaurar a conta." });
    }
  };

  const handleCancel = async () => {
    if (!id || !account) return;
    try {
      await update({ id, data: { status: "cancelled" as any }, previousStatus: account.status });
      toast({ title: "Conta cancelada", description: "A conta foi marcada como cancelada." });
      navigate("/contas-receber");
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível cancelar a conta." });
    }
  };

  const handleDuplicate = async () => {
    if (!account) return;
    try {
      await create({
        type: account.type,
        category: account.category,
        amount: Number(account.amount),
        description: account.description + " (cópia)",
        date: account.date,
        due_date: account.due_date || undefined,
        status: "pending",
        payment_method: account.payment_method || undefined,
        notes: account.notes || undefined,
        client_id: account.client_id || undefined,
        service_id: account.service_id || undefined,
      });
      toast({ title: "Conta duplicada", description: "Uma cópia foi criada como pendente." });
      navigate("/contas-receber");
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível duplicar a conta." });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!account) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Conta não encontrada.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/contas-receber")}>
            Voltar
          </Button>
        </div>
      </AppLayout>
    );
  }

  const isPaid = account.status === "paid";
  const isCancelled = account.status === "cancelled";
  const canRestore = isPaid || isCancelled;

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={() => navigate("/contas-receber")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <h1 className="text-2xl font-bold text-foreground">Editar Conta a Receber</h1>
            <p className="text-muted-foreground">Altere os dados da conta</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canRestore && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handleRestore} disabled={isUpdating}>
                <RotateCcw className="h-4 w-4" />
                Restaurar p/ Pendente
              </Button>
            )}
            {!isCancelled && !isPaid && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <XCircle className="h-4 w-4" />
                    Cancelar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar conta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A conta será marcada como cancelada. Você poderá restaurá-la depois.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel}>Cancelar conta</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleDuplicate}>
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir conta a receber?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
      <ReceivableFullForm
        onSubmit={handleSubmit}
        isSubmitting={isUpdating}
        onCancel={() => navigate("/contas-receber")}
        initialData={account}
      />
    </AppLayout>
  );
}
