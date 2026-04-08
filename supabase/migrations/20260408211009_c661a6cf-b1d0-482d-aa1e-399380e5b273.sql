
CREATE OR REPLACE FUNCTION public.approve_transactions(
  _transaction_ids uuid[],
  _organization_id uuid,
  _acting_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated_count int;
BEGIN
  -- Resolve acting user: prefer auth.uid(), fall back to explicit parameter
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := _acting_user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verify user belongs to organization
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_user_id AND organization_id = _organization_id
  ) AND NOT public.is_super_admin(v_user_id) THEN
    RAISE EXCEPTION 'Access denied: user does not belong to this organization';
  END IF;

  IF NOT is_org_admin_or_owner(v_user_id, _organization_id) THEN
    RAISE EXCEPTION 'Apenas gestores podem aprovar transações';
  END IF;

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

CREATE OR REPLACE FUNCTION public.reject_transactions(
  _transaction_ids uuid[],
  _organization_id uuid,
  _reason text DEFAULT NULL,
  _acting_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_updated_count int;
BEGIN
  -- Resolve acting user: prefer auth.uid(), fall back to explicit parameter
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    v_user_id := _acting_user_id;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verify user belongs to organization
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_user_id AND organization_id = _organization_id
  ) AND NOT public.is_super_admin(v_user_id) THEN
    RAISE EXCEPTION 'Access denied: user does not belong to this organization';
  END IF;

  IF NOT is_org_admin_or_owner(v_user_id, _organization_id) THEN
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
