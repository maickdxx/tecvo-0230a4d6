
-- 1. Create franchise table
CREATE TABLE public.ai_franchise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_slug text NOT NULL DEFAULT 'free',
  monthly_allowance int NOT NULL DEFAULT 0,
  used_this_period int NOT NULL DEFAULT 0,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.ai_franchise ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own org franchise"
  ON public.ai_franchise FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  ));

-- 2. Function to get or create franchise for an org
CREATE OR REPLACE FUNCTION public.ensure_franchise(_org_id uuid)
RETURNS public.ai_franchise
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _row public.ai_franchise;
  _plan text;
  _allowance int;
BEGIN
  SELECT COALESCE(plan, 'free') INTO _plan FROM organizations WHERE id = _org_id;
  
  _allowance := CASE _plan
    WHEN 'starter' THEN 3000
    WHEN 'essential' THEN 8000
    WHEN 'pro' THEN 20000
    ELSE 0
  END;

  INSERT INTO ai_franchise (organization_id, plan_slug, monthly_allowance, used_this_period, period_start)
  VALUES (_org_id, _plan, _allowance, 0, date_trunc('month', now()))
  ON CONFLICT (organization_id) DO UPDATE
    SET plan_slug = _plan,
        monthly_allowance = _allowance,
        updated_at = now()
  RETURNING * INTO _row;

  IF _row.period_start < date_trunc('month', now()) THEN
    UPDATE ai_franchise
    SET used_this_period = 0,
        period_start = date_trunc('month', now()),
        plan_slug = _plan,
        monthly_allowance = _allowance,
        updated_at = now()
    WHERE organization_id = _org_id
    RETURNING * INTO _row;
  END IF;

  RETURN _row;
END;
$$;

-- 3. Frontend-facing function
CREATE OR REPLACE FUNCTION public.get_franchise_status(_org_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _f public.ai_franchise;
  _credits_balance int;
BEGIN
  SELECT * INTO _f FROM ensure_franchise(_org_id);
  
  SELECT COALESCE(balance, 0) INTO _credits_balance
  FROM ai_credits WHERE organization_id = _org_id;

  RETURN json_build_object(
    'franchise_total', _f.monthly_allowance,
    'franchise_used', _f.used_this_period,
    'franchise_remaining', GREATEST(_f.monthly_allowance - _f.used_this_period, 0),
    'credits_balance', COALESCE(_credits_balance, 0),
    'period_start', _f.period_start,
    'plan_slug', _f.plan_slug
  );
END;
$$;

-- 4. Update consume RPC with franchise priority
CREATE OR REPLACE FUNCTION public.consume_ai_credits_with_log(
  _request_id uuid DEFAULT gen_random_uuid(),
  _org_id uuid DEFAULT NULL,
  _action_slug text DEFAULT 'unknown',
  _user_id uuid DEFAULT NULL,
  _model text DEFAULT NULL,
  _prompt_tokens int DEFAULT 0,
  _completion_tokens int DEFAULT 0,
  _total_tokens int DEFAULT 0,
  _duration_ms int DEFAULT 0,
  _status text DEFAULT 'pending'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _cost int;
  _franchise public.ai_franchise;
  _franchise_remaining int;
  _source text := 'franchise';
  _remaining_balance int := 0;
  _credits_balance int;
BEGIN
  SELECT credits_cost INTO _cost FROM ai_credit_config WHERE action_slug = _action_slug;
  IF _cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action: %', _action_slug;
  END IF;

  IF _cost = 0 THEN
    INSERT INTO ai_usage_logs (request_id, organization_id, user_id, action_slug, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, status, estimated_cost_usd)
    VALUES (_request_id, _org_id, _user_id, _action_slug, _model, _prompt_tokens, _completion_tokens, _total_tokens, _duration_ms, _status, 0);
    RETURN json_build_object('allowed', true, 'remaining_balance', 0, 'source', 'free', 'deduplicated', false);
  END IF;

  IF EXISTS (SELECT 1 FROM ai_usage_logs WHERE request_id = _request_id) THEN
    RETURN json_build_object('allowed', true, 'remaining_balance', 0, 'source', 'deduplicated', 'deduplicated', true);
  END IF;

  -- Check franchise first
  SELECT * INTO _franchise FROM ensure_franchise(_org_id);
  _franchise_remaining := GREATEST(_franchise.monthly_allowance - _franchise.used_this_period, 0);

  IF _franchise_remaining >= _cost THEN
    UPDATE ai_franchise
    SET used_this_period = used_this_period + _cost, updated_at = now()
    WHERE organization_id = _org_id;
    
    _remaining_balance := _franchise_remaining - _cost;
    _source := 'franchise';
  ELSE
    -- Fall back to purchased credits
    SELECT balance INTO _credits_balance
    FROM ai_credits
    WHERE organization_id = _org_id
    FOR UPDATE;

    IF _credits_balance IS NOT NULL AND _credits_balance >= _cost THEN
      UPDATE ai_credits SET balance = balance - _cost, updated_at = now()
      WHERE organization_id = _org_id;

      _remaining_balance := _credits_balance - _cost;
      _source := 'credits';

      INSERT INTO ai_credit_transactions (organization_id, user_id, action_type, amount, description, request_id)
      VALUES (_org_id, _user_id, _action_slug, -_cost, 'Consumo: ' || _action_slug, _request_id);
    ELSE
      -- Fallback: allow but flag — no hard block
      _source := 'fallback';
      _remaining_balance := 0;
    END IF;
  END IF;

  -- Always log usage
  INSERT INTO ai_usage_logs (request_id, organization_id, user_id, action_slug, model, prompt_tokens, completion_tokens, total_tokens, duration_ms, status, estimated_cost_usd)
  VALUES (_request_id, _org_id, _user_id, _action_slug, _model, _prompt_tokens, _completion_tokens, _total_tokens, _duration_ms, _status, 0);

  RETURN json_build_object('allowed', true, 'remaining_balance', _remaining_balance, 'source', _source, 'deduplicated', false);
END;
$$;

-- 5. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_franchise;
