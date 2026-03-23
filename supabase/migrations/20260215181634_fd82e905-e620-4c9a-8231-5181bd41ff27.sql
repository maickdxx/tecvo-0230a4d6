
-- 1. Create default "Dinheiro" cash account for existing orgs that don't have one
INSERT INTO public.financial_accounts (organization_id, name, account_type, balance, is_active)
SELECT o.id, 'Dinheiro', 'cash', 0, true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.financial_accounts fa
  WHERE fa.organization_id = o.id AND fa.account_type = 'cash'
);

-- 2. Link the 'cash' payment method to the cash account
UPDATE public.payment_methods pm
SET default_financial_account_id = fa.id
FROM public.financial_accounts fa
WHERE fa.organization_id = pm.organization_id
  AND fa.account_type = 'cash'
  AND pm.slug = 'cash'
  AND pm.default_financial_account_id IS NULL;

-- 3. Update trigger function to also create the cash account and link it
CREATE OR REPLACE FUNCTION public.create_default_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cash_account_id UUID;
BEGIN
  -- Create default "Dinheiro" financial account
  INSERT INTO public.financial_accounts (organization_id, name, account_type, balance, is_active)
  VALUES (NEW.id, 'Dinheiro', 'cash', 0, true)
  RETURNING id INTO cash_account_id;

  -- Basic payment methods (no installments)
  INSERT INTO public.payment_methods (organization_id, name, slug, fee_type, fee_value, is_default, installments, default_financial_account_id) VALUES
    (NEW.id, 'PIX', 'pix', 'percentage', 0, true, NULL, NULL),
    (NEW.id, 'Dinheiro', 'cash', 'percentage', 0, true, NULL, cash_account_id),
    (NEW.id, 'Cartão de Débito', 'debit_card', 'percentage', 0, true, NULL, NULL),
    (NEW.id, 'Boleto', 'boleto', 'fixed', 0, true, NULL, NULL),
    (NEW.id, 'Transferência', 'bank_transfer', 'percentage', 0, true, NULL, NULL);
  
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
