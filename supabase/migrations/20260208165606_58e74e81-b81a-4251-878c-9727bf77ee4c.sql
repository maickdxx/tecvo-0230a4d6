-- Fase 1: Financeiro Avançado - Contas a Pagar e Receber
-- Adicionar campos para controle de vencimento e status de pagamento

-- Adicionar novos campos na tabela transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS due_date date,
ADD COLUMN IF NOT EXISTS payment_date date,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'paid' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
ADD COLUMN IF NOT EXISTS recurrence text CHECK (recurrence IS NULL OR recurrence IN ('weekly', 'monthly', 'yearly')),
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

-- Para transações existentes, definir status como 'paid' e payment_date igual a date
UPDATE public.transactions 
SET status = 'paid', payment_date = date
WHERE status IS NULL;

-- Criar índices para melhorar performance de consultas
CREATE INDEX IF NOT EXISTS idx_transactions_due_date ON public.transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON public.transactions(client_id);

-- Comentários para documentação
COMMENT ON COLUMN public.transactions.due_date IS 'Data de vencimento da conta';
COMMENT ON COLUMN public.transactions.payment_date IS 'Data efetiva do pagamento/recebimento';
COMMENT ON COLUMN public.transactions.status IS 'Status: pending (pendente), paid (pago), overdue (atrasado), cancelled (cancelado)';
COMMENT ON COLUMN public.transactions.recurrence IS 'Recorrência: weekly, monthly, yearly ou null para única';
COMMENT ON COLUMN public.transactions.client_id IS 'Cliente vinculado (para contas a receber)';