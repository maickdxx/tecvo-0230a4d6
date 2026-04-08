CREATE OR REPLACE FUNCTION public.consume_ai_credits(_org_id uuid, _action_slug text, _user_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cost INTEGER;
  _current_balance INTEGER;
  _action_label TEXT;
BEGIN
  -- When called by an authenticated user, use standard org access validation
  -- When called via service_role (webhooks/automations), auth.uid() is NULL
  -- In that case, validate the organization exists directly
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.validate_org_access(_org_id);
  ELSE
    -- Service-role context: verify org exists to prevent invalid debits
    IF NOT EXISTS (
      SELECT 1 FROM public.organizations WHERE id = _org_id
    ) THEN
      RAISE EXCEPTION 'Invalid organization: %', _org_id;
    END IF;
  END IF;

  SELECT credits_cost, label INTO _cost, _action_label
  FROM public.ai_credit_config WHERE action_slug = _action_slug;

  IF _cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action: %', _action_slug;
  END IF;

  SELECT balance INTO _current_balance
  FROM public.ai_credits WHERE organization_id = _org_id FOR UPDATE;

  IF _current_balance IS NULL THEN
    INSERT INTO public.ai_credits (organization_id, balance)
    VALUES (_org_id, 0) RETURNING balance INTO _current_balance;
  END IF;

  IF _current_balance < _cost THEN
    RETURN FALSE;
  END IF;

  UPDATE public.ai_credits
  SET balance = balance - _cost, updated_at = now()
  WHERE organization_id = _org_id;

  INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description, user_id)
  VALUES (_org_id, -_cost, _action_slug, _action_label, _user_id);

  RETURN TRUE;
END;
$function$;