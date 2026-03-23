
-- 1. Create reusable helper for org access validation
CREATE OR REPLACE FUNCTION public.validate_org_access(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid() AND organization_id = _org_id
  ) AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: user does not belong to this organization';
  END IF;
END;
$function$;

-- 2. Secure add_ai_credits
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  _org_id uuid, _amount integer, _action_type text, _description text, _user_id uuid DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_balance INTEGER;
BEGIN
  PERFORM public.validate_org_access(_org_id);

  INSERT INTO public.ai_credits (organization_id, balance)
  VALUES (_org_id, _amount)
  ON CONFLICT (organization_id) DO UPDATE
  SET balance = ai_credits.balance + _amount, updated_at = now()
  RETURNING balance INTO _new_balance;

  INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description, user_id)
  VALUES (_org_id, _amount, _action_type, _description, _user_id);

  RETURN _new_balance;
END;
$function$;

-- 3. Secure can_create_service
CREATE OR REPLACE FUNCTION public.can_create_service(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  org_plan TEXT;
  org_plan_expires_at TIMESTAMPTZ;
  current_usage INT;
  service_limit INT;
  current_month TEXT;
BEGIN
  PERFORM public.validate_org_access(org_id);

  SELECT plan, plan_expires_at INTO org_plan, org_plan_expires_at
  FROM public.organizations WHERE id = org_id;

  IF org_plan IS NOT NULL AND org_plan != 'free' AND org_plan_expires_at IS NOT NULL AND org_plan_expires_at < NOW() THEN
    org_plan := 'free';
  END IF;

  IF org_plan = 'pro' OR org_plan = 'essential' THEN
    RETURN TRUE;
  END IF;

  IF org_plan = 'starter' THEN
    service_limit := 30;
  ELSE
    service_limit := 10;
  END IF;

  current_month := to_char(NOW(), 'YYYY-MM');
  SELECT COALESCE(services_created, 0) INTO current_usage
  FROM public.organization_usage
  WHERE organization_id = org_id AND month_year = current_month;

  IF current_usage IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN current_usage < service_limit;
END;
$function$;

-- 4. Secure consume_ai_credits
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _org_id uuid, _action_slug text, _user_id uuid DEFAULT NULL::uuid
)
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
  PERFORM public.validate_org_access(_org_id);

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

-- 5. Secure transfer_between_accounts
CREATE OR REPLACE FUNCTION public.transfer_between_accounts(
  _from_account_id uuid, _to_account_id uuid, _amount numeric, _organization_id uuid, _notes text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_from_balance numeric;
  v_date text;
BEGIN
  PERFORM public.validate_org_access(_organization_id);

  IF _amount <= 0 THEN
    RAISE EXCEPTION 'O valor da transferência deve ser positivo';
  END IF;

  IF _from_account_id = _to_account_id THEN
    RAISE EXCEPTION 'Conta de origem e destino devem ser diferentes';
  END IF;

  v_date := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');

  IF _from_account_id < _to_account_id THEN
    PERFORM 1 FROM public.financial_accounts WHERE id = _from_account_id FOR UPDATE;
    PERFORM 1 FROM public.financial_accounts WHERE id = _to_account_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.financial_accounts WHERE id = _to_account_id FOR UPDATE;
    PERFORM 1 FROM public.financial_accounts WHERE id = _from_account_id FOR UPDATE;
  END IF;

  SELECT balance INTO v_from_balance
  FROM public.financial_accounts
  WHERE id = _from_account_id AND organization_id = _organization_id;

  IF v_from_balance IS NULL THEN
    RAISE EXCEPTION 'Conta de origem não encontrada';
  END IF;

  IF v_from_balance < _amount THEN
    RAISE EXCEPTION 'Saldo insuficiente na conta de origem';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE id = _to_account_id AND organization_id = _organization_id
  ) THEN
    RAISE EXCEPTION 'Conta de destino não encontrada';
  END IF;

  UPDATE public.financial_accounts SET balance = balance - _amount, updated_at = now() WHERE id = _from_account_id;
  UPDATE public.financial_accounts SET balance = balance + _amount, updated_at = now() WHERE id = _to_account_id;

  INSERT INTO public.transactions
    (organization_id, type, category, amount, description, date, due_date, status, payment_date, financial_account_id, notes)
  VALUES
    (_organization_id, 'expense', 'transfer', _amount, 'Transferência entre contas', v_date, v_date, 'paid', v_date, _from_account_id, _notes),
    (_organization_id, 'income', 'transfer', _amount, 'Transferência entre contas', v_date, v_date, 'paid', v_date, _to_account_id, _notes);
END;
$function$;

-- 6. Refactor get_dashboard_stats and get_company_health_indicators to use the helper
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _org_id uuid, _start_date text, _end_date text,
  _prev_start_date text, _prev_end_date text, _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _income numeric; _expense numeric;
  _prev_income numeric; _prev_expense numeric;
  _income_service_paid_count integer; _forecasted_revenue numeric;
  _total_services integer; _completed_services integer; _pending_services integer;
  _revenue_by_type jsonb; _count_by_type jsonb;
  _cancelled_count integer; _avg_exec_days numeric;
BEGIN
  PERFORM public.validate_org_access(_org_id);

  SELECT COALESCE(SUM(amount), 0) INTO _income FROM transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid'
    AND payment_date >= _start_date AND payment_date <= _end_date AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _income_service_paid_count FROM transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid' AND service_id IS NOT NULL
    AND payment_date >= _start_date AND payment_date <= _end_date AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _expense FROM transactions
  WHERE organization_id = _org_id AND type = 'expense' AND status = 'paid'
    AND payment_date >= _start_date AND payment_date <= _end_date AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _prev_income FROM transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid'
    AND payment_date >= _prev_start_date AND payment_date <= _prev_end_date AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _prev_expense FROM transactions
  WHERE organization_id = _org_id AND type = 'expense' AND status = 'paid'
    AND payment_date >= _prev_start_date AND payment_date <= _prev_end_date AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(value), 0) INTO _forecasted_revenue FROM services
  WHERE organization_id = _org_id AND status = 'scheduled'
    AND scheduled_date >= _start_date AND scheduled_date <= _end_date
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _total_services FROM services
  WHERE organization_id = _org_id AND created_at >= _start_date AND created_at <= (_end_date::date + 1)::text
    AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote' AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _completed_services FROM services
  WHERE organization_id = _org_id AND status = 'completed'
    AND completed_date >= _start_date AND completed_date <= _end_date
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _pending_services FROM services
  WHERE organization_id = _org_id AND status IN ('pending', 'scheduled')
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(jsonb_object_agg(st, total), '{}'::jsonb) INTO _revenue_by_type FROM (
    SELECT service_type::text AS st, COALESCE(SUM(value), 0) AS total FROM services
    WHERE organization_id = _org_id AND status = 'completed'
      AND completed_date >= _start_date AND completed_date <= _end_date
      AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    GROUP BY service_type) sub;

  SELECT COALESCE(jsonb_object_agg(st, cnt), '{}'::jsonb) INTO _count_by_type FROM (
    SELECT service_type::text AS st, COUNT(*) AS cnt FROM services
    WHERE organization_id = _org_id AND status = 'completed'
      AND completed_date >= _start_date AND completed_date <= _end_date
      AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    GROUP BY service_type) sub;

  SELECT COUNT(*) INTO _cancelled_count FROM services
  WHERE organization_id = _org_id AND status = 'cancelled'
    AND created_at >= _start_date AND created_at <= (_end_date::date + 1)::text
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_date - created_at)) / 86400.0), 0) INTO _avg_exec_days FROM services
  WHERE organization_id = _org_id AND status = 'completed'
    AND completed_date >= _start_date AND completed_date <= _end_date
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  RETURN jsonb_build_object(
    'income', _income, 'expense', _expense,
    'prev_income', _prev_income, 'prev_expense', _prev_expense,
    'income_service_paid_count', _income_service_paid_count,
    'forecasted_revenue', _forecasted_revenue,
    'total_services', _total_services, 'completed_services', _completed_services,
    'pending_services', _pending_services,
    'revenue_by_type', _revenue_by_type, 'count_by_type', _count_by_type,
    'cancelled_count', _cancelled_count, 'avg_exec_days', _avg_exec_days
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_company_health_indicators(
  _org_id uuid, _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _30d_ago timestamptz := now() - interval '30 days';
  _7d_ago timestamptz := now() - interval '7 days';
BEGIN
  PERFORM public.validate_org_access(_org_id);

  RETURN jsonb_build_object(
    'has_scheduled', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND scheduled_date IS NOT NULL AND status != 'cancelled' AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)),
    'has_recently_completed', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'completed' AND completed_date >= _30d_ago AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)),
    'has_confirmed_income', EXISTS(SELECT 1 FROM transactions WHERE organization_id = _org_id AND type = 'income' AND status = 'paid' AND (_is_demo OR is_demo_data = false)),
    'has_overdue', EXISTS(SELECT 1 FROM transactions WHERE organization_id = _org_id AND status = 'pending' AND due_date IS NOT NULL AND due_date::date < CURRENT_DATE AND (_is_demo OR is_demo_data = false)),
    'client_count', (SELECT COUNT(*) FROM clients WHERE organization_id = _org_id AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false))::integer,
    'service_count', (SELECT COUNT(*) FROM services WHERE organization_id = _org_id AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote' AND (_is_demo OR is_demo_data = false))::integer,
    'completed_count', (SELECT COUNT(*) FROM services WHERE organization_id = _org_id AND status = 'completed' AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false))::integer,
    'team_count', (SELECT COUNT(*) FROM profiles WHERE organization_id = _org_id)::integer,
    'has_recent_services', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND created_at >= _7d_ago AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)),
    'has_recent_transactions', EXISTS(SELECT 1 FROM transactions WHERE organization_id = _org_id AND created_at >= _7d_ago AND (_is_demo OR is_demo_data = false)),
    'total_account_balance', COALESCE((SELECT SUM(balance) FROM financial_accounts WHERE organization_id = _org_id AND is_active = true), 0)::numeric,
    'pending_expenses', COALESCE((SELECT SUM(amount) FROM transactions WHERE organization_id = _org_id AND type = 'expense' AND status IN ('pending', 'overdue') AND (_is_demo OR is_demo_data = false)), 0)::numeric,
    'has_scheduled_without_value', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'scheduled' AND (value IS NULL OR value = 0) AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)),
    'has_eligible_recurrence', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'completed' AND service_type IN ('installation', 'cleaning') AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)),
    'has_active_accounts', EXISTS(SELECT 1 FROM financial_accounts WHERE organization_id = _org_id AND is_active = true),
    'has_scheduled_service', EXISTS(SELECT 1 FROM services WHERE organization_id = _org_id AND scheduled_date IS NOT NULL AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false))
  );
END;
$function$;
