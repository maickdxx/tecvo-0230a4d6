
-- RPC: get_dashboard_stats — returns all aggregated dashboard metrics in a single call
CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  _org_id uuid,
  _start_date text,
  _end_date text,
  _prev_start_date text,
  _prev_end_date text,
  _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  _income numeric;
  _expense numeric;
  _prev_income numeric;
  _prev_expense numeric;
  _income_service_paid_count integer;
  _forecasted_revenue numeric;
  _total_services integer;
  _completed_services integer;
  _pending_services integer;
  _revenue_by_type jsonb;
  _count_by_type jsonb;
  _cancelled_count integer;
  _avg_exec_days numeric;
BEGIN
  -- Current period income (paid, by payment_date)
  SELECT COALESCE(SUM(amount), 0)
  INTO _income
  FROM transactions
  WHERE organization_id = _org_id
    AND type = 'income' AND status = 'paid'
    AND payment_date >= _start_date AND payment_date <= _end_date
    AND (_is_demo OR is_demo_data = false);

  -- Income with service_id (for ticket medio)
  SELECT COUNT(*)
  INTO _income_service_paid_count
  FROM transactions
  WHERE organization_id = _org_id
    AND type = 'income' AND status = 'paid'
    AND service_id IS NOT NULL
    AND payment_date >= _start_date AND payment_date <= _end_date
    AND (_is_demo OR is_demo_data = false);

  -- Current period expense (paid, by payment_date)
  SELECT COALESCE(SUM(amount), 0)
  INTO _expense
  FROM transactions
  WHERE organization_id = _org_id
    AND type = 'expense' AND status = 'paid'
    AND payment_date >= _start_date AND payment_date <= _end_date
    AND (_is_demo OR is_demo_data = false);

  -- Previous period income
  SELECT COALESCE(SUM(amount), 0)
  INTO _prev_income
  FROM transactions
  WHERE organization_id = _org_id
    AND type = 'income' AND status = 'paid'
    AND payment_date >= _prev_start_date AND payment_date <= _prev_end_date
    AND (_is_demo OR is_demo_data = false);

  -- Previous period expense
  SELECT COALESCE(SUM(amount), 0)
  INTO _prev_expense
  FROM transactions
  WHERE organization_id = _org_id
    AND type = 'expense' AND status = 'paid'
    AND payment_date >= _prev_start_date AND payment_date <= _prev_end_date
    AND (_is_demo OR is_demo_data = false);

  -- Services in period (by scheduled_date, excluding quotes)
  SELECT
    COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress', 'completed')),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status IN ('scheduled', 'in_progress'))
  INTO _total_services, _completed_services, _pending_services
  FROM services
  WHERE organization_id = _org_id
    AND deleted_at IS NULL
    AND document_type IS DISTINCT FROM 'quote'
    AND scheduled_date IS NOT NULL
    AND (scheduled_date::date) >= _start_date::date
    AND (scheduled_date::date) <= _end_date::date
    AND (_is_demo OR is_demo_data = false);

  -- Forecasted revenue (scheduled/in_progress services)
  SELECT COALESCE(SUM(value), 0)
  INTO _forecasted_revenue
  FROM services
  WHERE organization_id = _org_id
    AND deleted_at IS NULL
    AND document_type IS DISTINCT FROM 'quote'
    AND status IN ('scheduled', 'in_progress')
    AND scheduled_date IS NOT NULL
    AND (scheduled_date::date) >= _start_date::date
    AND (scheduled_date::date) <= _end_date::date
    AND (_is_demo OR is_demo_data = false);

  -- Revenue by service type (for Revenue Engine)
  SELECT COALESCE(jsonb_object_agg(st, rev), '{}'::jsonb)
  INTO _revenue_by_type
  FROM (
    SELECT s.service_type::text AS st, SUM(t.amount) AS rev
    FROM transactions t
    JOIN services s ON s.id = t.service_id
    WHERE t.organization_id = _org_id
      AND t.type = 'income' AND t.status = 'paid'
      AND t.service_id IS NOT NULL
      AND t.payment_date >= _start_date AND t.payment_date <= _end_date
      AND (_is_demo OR t.is_demo_data = false)
    GROUP BY s.service_type
  ) sub;

  -- Count by service type
  SELECT COALESCE(jsonb_object_agg(service_type::text, cnt), '{}'::jsonb)
  INTO _count_by_type
  FROM (
    SELECT service_type, COUNT(*) AS cnt
    FROM services
    WHERE organization_id = _org_id
      AND deleted_at IS NULL
      AND document_type IS DISTINCT FROM 'quote'
      AND status != 'cancelled'
      AND scheduled_date IS NOT NULL
      AND (scheduled_date::date) >= _start_date::date
      AND (scheduled_date::date) <= _end_date::date
      AND (_is_demo OR is_demo_data = false)
    GROUP BY service_type
  ) sub;

  -- Cancelled count
  SELECT COUNT(*)
  INTO _cancelled_count
  FROM services
  WHERE organization_id = _org_id
    AND deleted_at IS NULL
    AND document_type IS DISTINCT FROM 'quote'
    AND status = 'cancelled'
    AND scheduled_date IS NOT NULL
    AND (scheduled_date::date) >= _start_date::date
    AND (scheduled_date::date) <= _end_date::date
    AND (_is_demo OR is_demo_data = false);

  -- Avg execution days
  SELECT COALESCE(AVG(GREATEST(DATE_PART('day', completed_date::timestamp - scheduled_date::timestamp), 0)), 0)
  INTO _avg_exec_days
  FROM services
  WHERE organization_id = _org_id
    AND deleted_at IS NULL
    AND document_type IS DISTINCT FROM 'quote'
    AND status = 'completed'
    AND scheduled_date IS NOT NULL AND completed_date IS NOT NULL
    AND (scheduled_date::date) >= _start_date::date
    AND (scheduled_date::date) <= _end_date::date
    AND (_is_demo OR is_demo_data = false);

  result := jsonb_build_object(
    'income', _income,
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
    'avg_exec_days', ROUND(_avg_exec_days)
  );

  RETURN result;
END;
$$;

-- RPC: get_company_health_indicators — returns all health score inputs
CREATE OR REPLACE FUNCTION public.get_company_health_indicators(
  _org_id uuid,
  _is_demo boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _now timestamptz := now();
  _30d_ago timestamptz := now() - interval '30 days';
  _7d_ago timestamptz := now() - interval '7 days';
BEGIN
  RETURN jsonb_build_object(
    'has_scheduled', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND scheduled_date IS NOT NULL AND status != 'cancelled' AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    ),
    'has_recently_completed', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'completed' AND completed_date >= _30d_ago AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    ),
    'has_confirmed_income', EXISTS(
      SELECT 1 FROM transactions WHERE organization_id = _org_id AND type = 'income' AND status = 'paid' AND (_is_demo OR is_demo_data = false)
    ),
    'has_overdue', EXISTS(
      SELECT 1 FROM transactions WHERE organization_id = _org_id AND status = 'pending' AND due_date IS NOT NULL AND due_date::date < CURRENT_DATE AND (_is_demo OR is_demo_data = false)
    ),
    'client_count', (SELECT COUNT(*) FROM clients WHERE organization_id = _org_id AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false))::integer,
    'service_count', (SELECT COUNT(*) FROM services WHERE organization_id = _org_id AND deleted_at IS NULL AND document_type IS DISTINCT FROM 'quote' AND (_is_demo OR is_demo_data = false))::integer,
    'completed_count', (SELECT COUNT(*) FROM services WHERE organization_id = _org_id AND status = 'completed' AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false))::integer,
    'team_count', (SELECT COUNT(*) FROM profiles WHERE organization_id = _org_id)::integer,
    'has_recent_services', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND created_at >= _7d_ago AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    ),
    'has_recent_transactions', EXISTS(
      SELECT 1 FROM transactions WHERE organization_id = _org_id AND created_at >= _7d_ago AND (_is_demo OR is_demo_data = false)
    ),
    'total_account_balance', COALESCE((SELECT SUM(balance) FROM financial_accounts WHERE organization_id = _org_id AND is_active = true), 0)::numeric,
    'pending_expenses', COALESCE((SELECT SUM(amount) FROM transactions WHERE organization_id = _org_id AND type = 'expense' AND status IN ('pending', 'overdue') AND (_is_demo OR is_demo_data = false)), 0)::numeric,
    'has_scheduled_without_value', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'scheduled' AND (value IS NULL OR value = 0) AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    ),
    'has_eligible_recurrence', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND status = 'completed' AND service_type IN ('installation', 'cleaning') AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    ),
    'has_active_accounts', EXISTS(
      SELECT 1 FROM financial_accounts WHERE organization_id = _org_id AND is_active = true
    ),
    'has_scheduled_service', EXISTS(
      SELECT 1 FROM services WHERE organization_id = _org_id AND scheduled_date IS NOT NULL AND deleted_at IS NULL AND (_is_demo OR is_demo_data = false)
    )
  );
END;
$$;
