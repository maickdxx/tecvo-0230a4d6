-- Criar tabela payment_methods
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  fee_type text NOT NULL DEFAULT 'percentage',
  fee_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Unique constraint: um slug por organização
ALTER TABLE public.payment_methods ADD CONSTRAINT unique_payment_method_slug 
  UNIQUE (organization_id, slug);

-- RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payment methods in their org"
  ON public.payment_methods FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create payment methods in their org"
  ON public.payment_methods FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update payment methods in their org"
  ON public.payment_methods FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete payment methods in their org"
  ON public.payment_methods FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Função para criar formas de pagamento padrão
CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default) VALUES
    (NEW.id, 'PIX', 'pix', 'percentage', 0, true),
    (NEW.id, 'Dinheiro', 'cash', 'percentage', 0, true),
    (NEW.id, 'Cartão de Crédito', 'credit_card', 'percentage', 0, true),
    (NEW.id, 'Cartão de Débito', 'debit_card', 'percentage', 0, true),
    (NEW.id, 'Boleto', 'boleto', 'fixed', 0, true),
    (NEW.id, 'Transferência', 'bank_transfer', 'percentage', 0, true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para novas organizações
CREATE TRIGGER on_organization_created_payment_methods
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_payment_methods();

-- Inserir para organizações existentes
INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default)
SELECT 
  o.id,
  pm.name,
  pm.slug,
  pm.fee_type,
  pm.fee_value,
  true
FROM public.organizations o
CROSS JOIN (VALUES
  ('PIX', 'pix', 'percentage', 0::numeric),
  ('Dinheiro', 'cash', 'percentage', 0::numeric),
  ('Cartão de Crédito', 'credit_card', 'percentage', 0::numeric),
  ('Cartão de Débito', 'debit_card', 'percentage', 0::numeric),
  ('Boleto', 'boleto', 'fixed', 0::numeric),
  ('Transferência', 'bank_transfer', 'percentage', 0::numeric)
) AS pm(name, slug, fee_type, fee_value)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods WHERE organization_id = o.id
);