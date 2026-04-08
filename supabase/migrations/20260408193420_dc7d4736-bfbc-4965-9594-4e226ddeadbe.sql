
-- 1. Add new columns to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending_approval',
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS approved_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS transaction_origin text NOT NULL DEFAULT 'panel';

-- 2. Backfill existing data safely
UPDATE public.transactions SET approval_status = 'approved', approved_at = updated_at WHERE status = 'paid';
UPDATE public.transactions SET approval_status = 'pending_approval' WHERE status IN ('pending', 'overdue');
UPDATE public.transactions SET approval_status = 'rejected' WHERE status = 'cancelled';

-- 3. Index for fast pending queries
CREATE INDEX IF NOT EXISTS idx_transactions_approval_pending 
  ON public.transactions (organization_id, approval_status, date) 
  WHERE approval_status = 'pending_approval' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_approval_status
  ON public.transactions (organization_id, approval_status);

-- 4. Update the balance sync trigger to require approval_status = 'approved'
CREATE OR REPLACE FUNCTION public.handle_transaction_balance_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    v_amount_diff numeric;
BEGIN
    -- Handle INSERT
    IF (TG_OP = 'INSERT') THEN
        IF NEW.status = 'paid' AND NEW.approval_status = 'approved' AND NEW.financial_account_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = NEW.financial_account_id;
        END IF;

    -- Handle UPDATE
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Reverse OLD effect if it was paid+approved and not deleted
        IF OLD.status = 'paid' AND OLD.approval_status = 'approved' AND OLD.financial_account_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = OLD.financial_account_id;
        END IF;

        -- Apply NEW effect if it is paid+approved and not deleted
        IF NEW.status = 'paid' AND NEW.approval_status = 'approved' AND NEW.financial_account_id IS NOT NULL AND NEW.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN NEW.type = 'income' THEN NEW.amount ELSE -NEW.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = NEW.financial_account_id;
        END IF;

    -- Handle DELETE
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.status = 'paid' AND OLD.approval_status = 'approved' AND OLD.financial_account_id IS NOT NULL AND OLD.deleted_at IS NULL THEN
            v_amount_diff := CASE WHEN OLD.type = 'income' THEN -OLD.amount ELSE OLD.amount END;
            UPDATE public.financial_accounts 
            SET balance = balance + v_amount_diff, updated_at = now()
            WHERE id = OLD.financial_account_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$;

-- 5. RPC to approve transactions (admin/owner only)
CREATE OR REPLACE FUNCTION public.approve_transactions(
  _transaction_ids uuid[],
  _organization_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_updated_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Validate org access
  PERFORM validate_org_access(_organization_id);

  -- Verify admin/owner role
  IF NOT is_org_admin_or_owner(v_user_id) THEN
    RAISE EXCEPTION 'Apenas gestores podem aprovar transações';
  END IF;

  -- Update transactions: set approved + paid
  UPDATE public.transactions
  SET 
    approval_status = 'approved',
    status = 'paid',
    approved_by_user_id = v_user_id,
    approved_at = now(),
    payment_date = COALESCE(payment_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = ANY(_transaction_ids)
    AND organization_id = _organization_id
    AND approval_status = 'pending_approval'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN json_build_object('approved_count', v_updated_count);
END;
$$;

-- 6. RPC to reject transactions (admin/owner only)
CREATE OR REPLACE FUNCTION public.reject_transactions(
  _transaction_ids uuid[],
  _organization_id uuid,
  _reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_user_id uuid;
  v_updated_count int;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  PERFORM validate_org_access(_organization_id);

  IF NOT is_org_admin_or_owner(v_user_id) THEN
    RAISE EXCEPTION 'Apenas gestores podem reprovar transações';
  END IF;

  UPDATE public.transactions
  SET 
    approval_status = 'rejected',
    status = 'cancelled',
    approved_by_user_id = v_user_id,
    approved_at = now(),
    rejection_reason = _reason,
    updated_at = now()
  WHERE id = ANY(_transaction_ids)
    AND organization_id = _organization_id
    AND approval_status = 'pending_approval'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  RETURN json_build_object('rejected_count', v_updated_count);
END;
$$;

-- 7. RPC to get pending approval summary (for Laura daily summary)
CREATE OR REPLACE FUNCTION public.get_pending_approval_summary(
  _organization_id uuid,
  _date date DEFAULT CURRENT_DATE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_result json;
BEGIN
  PERFORM validate_org_access(_organization_id);

  SELECT json_build_object(
    'total_pending', COUNT(*),
    'pending_income_count', COUNT(*) FILTER (WHERE type = 'income'),
    'pending_expense_count', COUNT(*) FILTER (WHERE type = 'expense'),
    'pending_income_total', COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0),
    'pending_expense_total', COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0),
    'pending_balance', COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)
  ) INTO v_result
  FROM public.transactions
  WHERE organization_id = _organization_id
    AND approval_status = 'pending_approval'
    AND date = _date
    AND deleted_at IS NULL;

  RETURN v_result;
END;
$$;
