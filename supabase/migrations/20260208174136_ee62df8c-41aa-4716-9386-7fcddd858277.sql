-- Add installments column to payment_methods
ALTER TABLE public.payment_methods 
ADD COLUMN installments integer DEFAULT NULL;

-- Add constraint for valid installment values
ALTER TABLE public.payment_methods
ADD CONSTRAINT check_installments CHECK (installments IS NULL OR (installments >= 1 AND installments <= 12));

-- Update existing credit_card to be 1x
UPDATE public.payment_methods 
SET installments = 1, slug = 'credit_card_1x', name = 'Cartão de Crédito 1x', fee_value = 2.5
WHERE slug = 'credit_card' AND installments IS NULL;

-- Add installments 2x-12x for existing organizations
INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default, installments)
SELECT 
  o.id,
  'Cartão de Crédito ' || pm.installments || 'x',
  'credit_card_' || pm.installments || 'x',
  'percentage',
  pm.fee_value,
  false,
  pm.installments
FROM public.organizations o
CROSS JOIN (VALUES
  (2, 3.5),
  (3, 4.2),
  (4, 4.8),
  (5, 5.4),
  (6, 6.0),
  (7, 6.5),
  (8, 7.0),
  (9, 7.5),
  (10, 8.0),
  (11, 8.5),
  (12, 9.0)
) AS pm(installments, fee_value)
WHERE NOT EXISTS (
  SELECT 1 FROM public.payment_methods 
  WHERE organization_id = o.id AND slug = 'credit_card_' || pm.installments || 'x'
);

-- Update the trigger function to include installments for new organizations
CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Basic payment methods (no installments)
  INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default, installments) VALUES
    (NEW.id, 'PIX', 'pix', 'percentage', 0, true, NULL),
    (NEW.id, 'Dinheiro', 'cash', 'percentage', 0, true, NULL),
    (NEW.id, 'Cartão de Débito', 'debit_card', 'percentage', 0, true, NULL),
    (NEW.id, 'Boleto', 'boleto', 'fixed', 0, true, NULL),
    (NEW.id, 'Transferência', 'bank_transfer', 'percentage', 0, true, NULL);
  
  -- Credit card with installments (1x to 12x)
  INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default, installments) VALUES
    (NEW.id, 'Cartão de Crédito 1x', 'credit_card_1x', 'percentage', 2.5, true, 1),
    (NEW.id, 'Cartão de Crédito 2x', 'credit_card_2x', 'percentage', 3.5, false, 2),
    (NEW.id, 'Cartão de Crédito 3x', 'credit_card_3x', 'percentage', 4.2, false, 3),
    (NEW.id, 'Cartão de Crédito 4x', 'credit_card_4x', 'percentage', 4.8, false, 4),
    (NEW.id, 'Cartão de Crédito 5x', 'credit_card_5x', 'percentage', 5.4, false, 5),
    (NEW.id, 'Cartão de Crédito 6x', 'credit_card_6x', 'percentage', 6.0, false, 6),
    (NEW.id, 'Cartão de Crédito 7x', 'credit_card_7x', 'percentage', 6.5, false, 7),
    (NEW.id, 'Cartão de Crédito 8x', 'credit_card_8x', 'percentage', 7.0, false, 8),
    (NEW.id, 'Cartão de Crédito 9x', 'credit_card_9x', 'percentage', 7.5, false, 9),
    (NEW.id, 'Cartão de Crédito 10x', 'credit_card_10x', 'percentage', 8.0, false, 10),
    (NEW.id, 'Cartão de Crédito 11x', 'credit_card_11x', 'percentage', 8.5, false, 11),
    (NEW.id, 'Cartão de Crédito 12x', 'credit_card_12x', 'percentage', 9.0, false, 12);
  
  RETURN NEW;
END;
$function$;