-- Enum para tipo de transação
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Enum para categorias
CREATE TYPE public.transaction_category AS ENUM (
  'service', 'product', 'other_income',
  'material', 'labor', 'fuel', 'maintenance', 'rent', 'utilities', 'marketing', 'other_expense'
);

-- Tabela de transações financeiras
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  type transaction_type NOT NULL,
  category transaction_category NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_transactions_org_id ON public.transactions(organization_id);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_date ON public.transactions(date);
CREATE INDEX idx_transactions_service_id ON public.transactions(service_id);

-- Trigger para updated_at
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Habilitar RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view transactions in their organization"
  ON public.transactions FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create transactions in their organization"
  ON public.transactions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update transactions in their organization"
  ON public.transactions FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete transactions in their organization"
  ON public.transactions FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());