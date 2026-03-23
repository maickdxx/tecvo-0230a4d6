-- Tabela de tipos de serviço customizados
CREATE TABLE public.service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- RLS para service_types
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view service types in their org" ON public.service_types
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create service types in their org" ON public.service_types
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update service types in their org" ON public.service_types
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete service types in their org" ON public.service_types
  FOR DELETE USING (organization_id = get_user_organization_id());

-- Tabela de categorias de transação customizadas
CREATE TABLE public.transaction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

-- RLS para transaction_categories
ALTER TABLE public.transaction_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view categories in their org" ON public.transaction_categories
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create categories in their org" ON public.transaction_categories
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update categories in their org" ON public.transaction_categories
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete categories in their org" ON public.transaction_categories
  FOR DELETE USING (organization_id = get_user_organization_id());

-- Função para inicializar tipos padrão para nova organização
CREATE OR REPLACE FUNCTION public.initialize_default_types()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Inserir tipos de serviço padrão
  INSERT INTO public.service_types (organization_id, name, slug, is_default) VALUES
    (NEW.id, 'Instalação', 'installation', true),
    (NEW.id, 'Manutenção', 'maintenance', true),
    (NEW.id, 'Limpeza', 'cleaning', true),
    (NEW.id, 'Reparo', 'repair', true);
  
  -- Inserir categorias de entrada padrão
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default) VALUES
    (NEW.id, 'Serviço', 'service', 'income', true),
    (NEW.id, 'Produto', 'product', 'income', true),
    (NEW.id, 'Outros', 'other_income', 'income', true);
  
  -- Inserir categorias de saída padrão
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default) VALUES
    (NEW.id, 'Material', 'material', 'expense', true),
    (NEW.id, 'Mão de obra', 'labor', 'expense', true),
    (NEW.id, 'Combustível', 'fuel', 'expense', true),
    (NEW.id, 'Manutenção', 'maintenance', 'expense', true),
    (NEW.id, 'Aluguel', 'rent', 'expense', true),
    (NEW.id, 'Utilidades', 'utilities', 'expense', true),
    (NEW.id, 'Marketing', 'marketing', 'expense', true),
    (NEW.id, 'Outros', 'other_expense', 'expense', true);
  
  RETURN NEW;
END;
$$;

-- Trigger para inicializar tipos quando organização é criada
CREATE TRIGGER on_organization_created_init_types
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_default_types();

-- Inserir tipos padrão para organizações existentes
INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT id, 'Instalação', 'installation', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT id, 'Manutenção', 'maintenance', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT id, 'Limpeza', 'cleaning', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT id, 'Reparo', 'repair', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Categorias de entrada para organizações existentes
INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Serviço', 'service', 'income', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Produto', 'product', 'income', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Outros', 'other_income', 'income', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Categorias de saída para organizações existentes
INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Material', 'material', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Mão de obra', 'labor', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Combustível', 'fuel', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Manutenção', 'maintenance', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Aluguel', 'rent', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Utilidades', 'utilities', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Marketing', 'marketing', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;

INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default)
SELECT id, 'Outros', 'other_expense', 'expense', true FROM public.organizations
ON CONFLICT (organization_id, slug) DO NOTHING;