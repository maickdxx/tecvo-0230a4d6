-- Criar tabela de fornecedores
CREATE TABLE public.suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  cnpj_cpf text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  category text,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

-- Políticas RLS usando a função existente get_user_organization_id()
CREATE POLICY "Users can view suppliers in their organization"
  ON public.suppliers FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create suppliers in their organization"
  ON public.suppliers FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update suppliers in their organization"
  ON public.suppliers FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete suppliers in their organization"
  ON public.suppliers FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Adicionar coluna supplier_id na tabela transactions
ALTER TABLE public.transactions ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;