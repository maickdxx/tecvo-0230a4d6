-- 1. Drop old function signature and recreate with org_id parameter
DROP FUNCTION IF EXISTS public.is_org_admin_or_owner(uuid);

CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id AND p.organization_id = _org_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'owner')
  )
$$;

-- 2. Recreate approve_transactions using new signature
CREATE OR REPLACE FUNCTION public.approve_transactions(_transaction_ids uuid[], _organization_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- 3. Recreate reject_transactions using new signature
CREATE OR REPLACE FUNCTION public.reject_transactions(_transaction_ids uuid[], _organization_id uuid, _reason text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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