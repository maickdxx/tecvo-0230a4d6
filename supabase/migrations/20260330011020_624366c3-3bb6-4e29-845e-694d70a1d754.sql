-- Update get_dashboard_stats to include pending income
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_org_id uuid, _start_date text, _end_date text, _prev_start_date text, _prev_end_date text, _is_demo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _income numeric; _expense numeric;
  _pending_income numeric; -- New field
  _prev_income numeric; _prev_expense numeric;
  _income_service_paid_count integer; _forecasted_revenue numeric;
  _total_services integer; _completed_services integer; _pending_services integer;
  _revenue_by_type jsonb; _count_by_type jsonb;
  _cancelled_count integer; _avg_exec_days numeric;
  _sd date := _start_date::date;
  _ed date := _end_date::date;
  _psd date := _prev_start_date::date;
  _ped date := _prev_end_date::date;
BEGIN
  PERFORM public.validate_org_access(_org_id);

  -- Real Income (Paid)
  SELECT COALESCE(SUM(amount), 0) INTO _income FROM public.transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid'
    AND payment_date >= _sd AND payment_date <= _ed
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  -- Pending Income (A Receber - Real Billed)
  SELECT COALESCE(SUM(amount), 0) INTO _pending_income FROM public.transactions
  WHERE organization_id = _org_id AND type = 'income' AND status IN ('pending', 'overdue')
    AND due_date >= _sd AND due_date <= _ed
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(DISTINCT service_id) INTO _income_service_paid_count FROM public.transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid' AND service_id IS NOT NULL
    AND payment_date >= _sd AND payment_date <= _ed
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _expense FROM public.transactions
  WHERE organization_id = _org_id AND type = 'expense' AND status = 'paid'
    AND payment_date >= _sd AND payment_date <= _ed
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _prev_income FROM public.transactions
  WHERE organization_id = _org_id AND type = 'income' AND status = 'paid'
    AND payment_date >= _psd AND payment_date <= _ped
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(SUM(amount), 0) INTO _prev_expense FROM public.transactions
  WHERE organization_id = _org_id AND type = 'expense' AND status = 'paid'
    AND payment_date >= _psd AND payment_date <= _ped
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  -- Forecasted Revenue (Services Scheduled/In Progress - Potential)
  SELECT COALESCE(SUM(value), 0) INTO _forecasted_revenue FROM public.services
  WHERE organization_id = _org_id AND status IN ('scheduled', 'in_progress')
    AND scheduled_date >= (_sd::text || ' 00:00:00')::timestamptz
    AND scheduled_date <= (_ed::text || ' 23:59:59')::timestamptz
    AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote'
    AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _total_services FROM public.services
  WHERE organization_id = _org_id
    AND scheduled_date >= (_sd::text || ' 00:00:00')::timestamptz
    AND scheduled_date <= (_ed::text || ' 23:59:59')::timestamptz
    AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote'
    AND status != 'cancelled'
    AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _completed_services FROM public.services
  WHERE organization_id = _org_id AND status = 'completed'
    AND completed_date >= (_sd::text || ' 00:00:00')::timestamptz
    AND completed_date <= (_ed::text || ' 23:59:59')::timestamptz
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COUNT(*) INTO _pending_services FROM public.services
  WHERE organization_id = _org_id AND status IN ('scheduled', 'in_progress')
    AND scheduled_date >= (_sd::text || ' 00:00:00')::timestamptz
    AND scheduled_date <= (_ed::text || ' 23:59:59')::timestamptz
    AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote'
    AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(jsonb_object_agg(st, total), '{}'::jsonb) INTO _revenue_by_type FROM (
    SELECT service_type::text AS st, COALESCE(SUM(value), 0) AS total FROM public.services
    WHERE organization_id = _org_id AND status = 'completed'
      AND completed_date >= (_sd::text || ' 00:00:00')::timestamptz
      AND completed_date <= (_ed::text || ' 23:59:59')::timestamptz
      AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    GROUP BY service_type) sub;

  SELECT COALESCE(jsonb_object_agg(st, cnt), '{}'::jsonb) INTO _count_by_type FROM (
    SELECT service_type::text AS st, COUNT(*) AS cnt FROM public.services
    WHERE organization_id = _org_id AND status = 'completed'
      AND completed_date >= (_sd::text || ' 00:00:00')::timestamptz
      AND completed_date <= (_ed::text || ' 23:59:59')::timestamptz
      AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    GROUP BY service_type) sub;

  SELECT COUNT(*) INTO _cancelled_count FROM public.services
  WHERE organization_id = _org_id AND status = 'cancelled'
    AND (completed_date >= (_sd::text || ' 00:00:00')::timestamptz AND completed_date <= (_ed::text || ' 23:59:59')::timestamptz OR
         scheduled_date >= (_sd::text || ' 00:00:00')::timestamptz AND scheduled_date <= (_ed::text || ' 23:59:59')::timestamptz)
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(completed_date, now()) - created_at)) / 86400), 0) INTO _avg_exec_days FROM public.services
  WHERE organization_id = _org_id AND status = 'completed'
    AND completed_date >= (_sd::text || ' 00:00:00')::timestamptz
    AND completed_date <= (_ed::text || ' 23:59:59')::timestamptz
    AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false);

  RETURN jsonb_build_object(
    'income', _income,
    'pending_income', _pending_income,
    'expense', _expense,
    'prev_income', _prev_income,
    'prev_expense', _prev_expense,
    'income_service_paid_count', _income_service_paid_count,
    'forecasted_revenue', _forecasted_revenue,
    'total_services', _total_services,
    'completed_services', _completed_services,
    'pending_services', _pending_services,
    'revenue_by_type', _revenue_by_type,
    'count_by_type', _count_by_type,
    'cancelled_count', _cancelled_count,
    'avg_exec_days', _avg_exec_days
  );
END;
$function$
