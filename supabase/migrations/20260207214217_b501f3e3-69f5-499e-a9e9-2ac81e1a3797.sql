-- Tabela de itens do orçamento/serviço
CREATE TABLE public.service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adicionar campos de orçamento na tabela de serviços
ALTER TABLE public.services
  ADD COLUMN payment_conditions TEXT,
  ADD COLUMN quote_validity_days INTEGER DEFAULT 30,
  ADD COLUMN quote_number SERIAL;

-- Índice para itens
CREATE INDEX idx_service_items_service_id ON public.service_items(service_id);

-- Habilitar RLS
ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para service_items
CREATE POLICY "Users can view items in their organization"
  ON public.service_items FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create items in their organization"
  ON public.service_items FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update items in their organization"
  ON public.service_items FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete items in their organization"
  ON public.service_items FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());