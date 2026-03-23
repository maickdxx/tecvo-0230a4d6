
-- 1. Add messaging_paused kill switch to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS messaging_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS messaging_paused_at timestamptz;
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS messaging_paused_reason text;

-- 2. Create unified message send log table
CREATE TABLE public.whatsapp_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid,
  channel_id uuid,
  source text NOT NULL, -- 'manual', 'bot', 'ai', 'cron', 'scheduled', 'broadcast', 'auto_notify', 'welcome', 'portal_otp', 'tips', 'password_reset'
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'blocked', 'error'
  blocked_reason text, -- 'rate_limit_org', 'rate_limit_contact', 'cooldown', 'messaging_paused', 'auto_pause'
  message_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for rate limit queries (org hourly count)
CREATE INDEX idx_whatsapp_message_log_org_time ON public.whatsapp_message_log (organization_id, created_at DESC);
-- Index for contact cooldown queries
CREATE INDEX idx_whatsapp_message_log_contact_time ON public.whatsapp_message_log (contact_id, created_at DESC) WHERE contact_id IS NOT NULL;
-- Index for status filtering
CREATE INDEX idx_whatsapp_message_log_status ON public.whatsapp_message_log (status, created_at DESC);

-- Enable RLS
ALTER TABLE public.whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read logs for their org
CREATE POLICY "Users can view own org message logs"
  ON public.whatsapp_message_log FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert message logs"
  ON public.whatsapp_message_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- 3. Create the check_send_limit function
CREATE OR REPLACE FUNCTION public.check_send_limit(
  _org_id uuid,
  _contact_id uuid DEFAULT NULL,
  _source text DEFAULT 'unknown'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _org_paused boolean;
  _org_paused_reason text;
  _org_hour_count integer;
  _contact_hour_count integer;
  _last_contact_send timestamptz;
  _org_limit integer := 200;
  _contact_limit integer := 10;
  _cooldown_seconds integer := 3;
  _auto_pause_threshold integer := 300;
  _result jsonb;
BEGIN
  -- 1. Check kill switch
  SELECT messaging_paused, messaging_paused_reason
  INTO _org_paused, _org_paused_reason
  FROM public.organizations
  WHERE id = _org_id;

  IF _org_paused THEN
    -- Log the blocked attempt
    INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, blocked_reason)
    VALUES (_org_id, _contact_id, _source, 'blocked', 'messaging_paused');
    
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'messaging_paused',
      'detail', COALESCE(_org_paused_reason, 'Envio pausado para esta organização')
    );
  END IF;

  -- 2. Check org rate limit (messages in last hour)
  SELECT COUNT(*) INTO _org_hour_count
  FROM public.whatsapp_message_log
  WHERE organization_id = _org_id
    AND status = 'sent'
    AND created_at > now() - interval '1 hour';

  IF _org_hour_count >= _org_limit THEN
    -- Log the blocked attempt
    INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, blocked_reason)
    VALUES (_org_id, _contact_id, _source, 'blocked', 'rate_limit_org');

    -- Auto-pause if exceeding auto_pause_threshold
    IF _org_hour_count >= _auto_pause_threshold THEN
      UPDATE public.organizations
      SET messaging_paused = true,
          messaging_paused_at = now(),
          messaging_paused_reason = 'Pausa automática: ' || _org_hour_count || ' mensagens em 1 hora (limite: ' || _auto_pause_threshold || ')'
      WHERE id = _org_id;
    END IF;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit_org',
      'detail', 'Limite de ' || _org_limit || ' mensagens por hora atingido (' || _org_hour_count || ' enviadas)',
      'count', _org_hour_count
    );
  END IF;

  -- 3. Check contact rate limit and cooldown (if contact_id provided)
  IF _contact_id IS NOT NULL THEN
    -- Contact hourly limit
    SELECT COUNT(*), MAX(created_at)
    INTO _contact_hour_count, _last_contact_send
    FROM public.whatsapp_message_log
    WHERE contact_id = _contact_id
      AND status = 'sent'
      AND created_at > now() - interval '1 hour';

    IF _contact_hour_count >= _contact_limit THEN
      INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, blocked_reason)
      VALUES (_org_id, _contact_id, _source, 'blocked', 'rate_limit_contact');
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'rate_limit_contact',
        'detail', 'Limite de ' || _contact_limit || ' mensagens por hora para este contato (' || _contact_hour_count || ' enviadas)',
        'count', _contact_hour_count
      );
    END IF;

    -- Cooldown check (minimum seconds between messages to same contact)
    IF _last_contact_send IS NOT NULL AND _last_contact_send > now() - (_cooldown_seconds || ' seconds')::interval THEN
      INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, blocked_reason)
      VALUES (_org_id, _contact_id, _source, 'blocked', 'cooldown');
      
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'cooldown',
        'detail', 'Intervalo mínimo de ' || _cooldown_seconds || 's entre mensagens para o mesmo contato'
      );
    END IF;
  END IF;

  -- All checks passed — log as sent
  INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, message_preview)
  VALUES (_org_id, _contact_id, _source, 'sent', NULL);

  RETURN jsonb_build_object('allowed', true);
END;
$$;
