-- Add request_id for correlation
ALTER TABLE public.ai_usage_logs ADD COLUMN IF NOT EXISTS request_id text;
ALTER TABLE public.ai_credit_transactions ADD COLUMN IF NOT EXISTS request_id text;

-- Index for fast lookups and deduplication
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_request_id ON public.ai_usage_logs (request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_credit_transactions_request_id ON public.ai_credit_transactions (request_id) WHERE request_id IS NOT NULL;

-- Atomic function: debit + log in one transaction
CREATE OR REPLACE FUNCTION public.consume_ai_credits_with_log(
  _request_id text,
  _org_id uuid,
  _action_slug text,
  _user_id uuid DEFAULT NULL,
  _model text DEFAULT NULL,
  _prompt_tokens integer DEFAULT 0,
  _completion_tokens integer DEFAULT 0,
  _total_tokens integer DEFAULT 0,
  _duration_ms integer DEFAULT 0,
  _status text DEFAULT 'success'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _cost INTEGER;
  _current_balance INTEGER;
  _action_label TEXT;
  _estimated_cost_usd NUMERIC;
  _result jsonb;
BEGIN
  -- Idempotency: if this request_id was already processed, return success without double-charging
  IF _request_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ai_credit_transactions WHERE request_id = _request_id
  ) THEN
    SELECT balance INTO _current_balance FROM public.ai_credits WHERE organization_id = _org_id;
    RETURN jsonb_build_object('allowed', true, 'remaining_balance', COALESCE(_current_balance, 0), 'request_id', _request_id, 'deduplicated', true);
  END IF;

  -- Validate org access
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.validate_org_access(_org_id);
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = _org_id) THEN
      RAISE EXCEPTION 'Invalid organization: %', _org_id;
    END IF;
  END IF;

  -- Get action cost
  SELECT credits_cost, label INTO _cost, _action_label
  FROM public.ai_credit_config WHERE action_slug = _action_slug;

  IF _cost IS NULL THEN
    -- Unknown action: log usage but don't block (fail-open for unconfigured)
    _cost := 0;
    _action_label := _action_slug;
  END IF;

  -- Estimate USD cost for logging
  _estimated_cost_usd := ((_prompt_tokens::numeric / 1000000) * 0.15) + ((_completion_tokens::numeric / 1000000) * 0.60);

  -- Lock and check balance (only if cost > 0)
  IF _cost > 0 THEN
    SELECT balance INTO _current_balance
    FROM public.ai_credits WHERE organization_id = _org_id FOR UPDATE;

    IF _current_balance IS NULL THEN
      INSERT INTO public.ai_credits (organization_id, balance)
      VALUES (_org_id, 0) RETURNING balance INTO _current_balance;
    END IF;

    IF _current_balance < _cost THEN
      -- Still log the attempt (with status 'blocked')
      INSERT INTO public.ai_usage_logs (organization_id, user_id, action_slug, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, duration_ms, status, request_id)
      VALUES (_org_id, _user_id, _action_slug, _model, 0, 0, 0, 0, 0, 'blocked', _request_id);

      SELECT balance INTO _current_balance FROM public.ai_credits WHERE organization_id = _org_id;
      RETURN jsonb_build_object('allowed', false, 'remaining_balance', COALESCE(_current_balance, 0), 'request_id', _request_id);
    END IF;

    -- Debit
    UPDATE public.ai_credits SET balance = balance - _cost, updated_at = now() WHERE organization_id = _org_id;

    -- Record transaction with request_id
    INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description, user_id, request_id)
    VALUES (_org_id, -_cost, _action_slug, _action_label, _user_id, _request_id);
  END IF;

  -- Log usage (always, even for free actions)
  INSERT INTO public.ai_usage_logs (organization_id, user_id, action_slug, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, duration_ms, status, request_id)
  VALUES (_org_id, _user_id, _action_slug, _model, _prompt_tokens, _completion_tokens, _total_tokens, _estimated_cost_usd, _duration_ms, _status, _request_id);

  SELECT balance INTO _current_balance FROM public.ai_credits WHERE organization_id = _org_id;
  RETURN jsonb_build_object('allowed', true, 'remaining_balance', COALESCE(_current_balance, 0), 'request_id', _request_id);
END;
$function$;