-- Rate limit counters table
CREATE TABLE IF NOT EXISTS public.ai_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  window_key text NOT NULL,
  request_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, window_key)
);

ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies — only service_role access
CREATE INDEX idx_ai_rate_limits_org_window ON public.ai_rate_limits (organization_id, window_key);
CREATE INDEX idx_ai_rate_limits_created ON public.ai_rate_limits (created_at);

-- Atomic rate limit check function
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _org_id uuid,
  _window_key text,
  _max_requests integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _current integer;
BEGIN
  -- Atomic upsert: increment or insert
  INSERT INTO public.ai_rate_limits (organization_id, window_key, request_count, updated_at)
  VALUES (_org_id, _window_key, 1, now())
  ON CONFLICT (organization_id, window_key)
  DO UPDATE SET request_count = ai_rate_limits.request_count + 1, updated_at = now()
  RETURNING request_count INTO _current;

  IF _current > _max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', _current,
      'limit', _max_requests,
      'window', _window_key
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', _current,
    'limit', _max_requests,
    'window', _window_key
  );
END;
$$;

-- Get daily AI credit consumption for an org
CREATE OR REPLACE FUNCTION public.get_ai_daily_usage(
  _org_id uuid,
  _today date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(ABS(amount)), 0)::integer
  FROM public.ai_credit_transactions
  WHERE organization_id = _org_id
    AND amount < 0
    AND created_at >= _today::timestamptz
    AND created_at < (_today + interval '1 day')::timestamptz;
$$;

-- Cleanup function for old rate limit windows (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_ai_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM public.ai_rate_limits
  WHERE created_at < now() - interval '2 hours'
  RETURNING 1 INTO _deleted;
  
  RETURN COALESCE(_deleted, 0);
END;
$$;