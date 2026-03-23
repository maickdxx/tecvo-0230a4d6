
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
  _from_account_id uuid,
  _to_account_id uuid,
  _amount numeric,
  _organization_id uuid,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from_balance numeric;
  v_date text;
BEGIN
  -- Validate amount
  IF _amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transferência deve ser positivo';
  END IF;

  IF _from_account_id = _to_account_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  v_date := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');

  -- Lock rows in consistent order to prevent deadlocks
  IF _from_account_id < _to_account_id THEN
    PERFORM 1 FROM public.financial_accounts WHERE id = _from_account_id FOR UPDATE;
    PERFORM 1 FROM public.financial_accounts WHERE id = _to_account_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.financial_accounts WHERE id = _to_account_id FOR UPDATE;
    PERFORM 1 FROM public.financial_accounts WHERE id = _from_account_id FOR UPDATE;
  END IF;

  -- Validate sufficient balance
  SELECT balance INTO v_from_balance
  FROM public.financial_accounts
  WHERE id = _from_account_id AND organization_id = _organization_id;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF v_from_balance < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem';
  END IF;

  -- Validate destination account belongs to same org
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE id = _to_account_id AND organization_id = _organization_id
  ) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  -- Debit origin
  UPDATE public.financial_accounts
  SET balance = balance - _amount, updated_at = now()
  WHERE id = _from_account_id;

  -- Credit destination
  UPDATE public.financial_accounts
  SET balance = balance + _amount, updated_at = now()
  WHERE id = _to_account_id;

  -- Create paired transfer transactions
  INSERT INTO public.transactions
    (organization_id, type, category, amount, description, date, due_date, status, payment_date, financial_account_id, notes)
  VALUES
    (_organization_id, 'expense', 'transfer', _amount, 'Transferência entre contas', v_date, v_date, 'paid', v_date, _from_account_id, _notes),
    (_organization_id, 'income', 'transfer', _amount, 'Transferência entre contas', v_date, v_date, 'paid', v_date, _to_account_id, _notes);
END;
$$;
