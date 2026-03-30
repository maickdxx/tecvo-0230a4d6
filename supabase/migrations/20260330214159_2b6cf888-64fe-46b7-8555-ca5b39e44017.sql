
-- Atomic function to adjust financial account balance safely (prevents race conditions)
CREATE OR REPLACE FUNCTION public.adjust_financial_account_balance(
  _account_id uuid,
  _delta numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance numeric;
BEGIN
  UPDATE public.financial_accounts
  SET balance = balance + _delta, updated_at = now()
  WHERE id = _account_id
  RETURNING balance INTO _new_balance;
  
  IF _new_balance IS NULL THEN
    RAISE EXCEPTION 'Conta financeira não encontrada: %', _account_id;
  END IF;
  
  RETURN _new_balance;
END;
$$;
