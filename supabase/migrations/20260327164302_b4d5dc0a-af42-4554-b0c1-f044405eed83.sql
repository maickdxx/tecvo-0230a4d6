CREATE OR REPLACE FUNCTION public.check_send_limit(
  _org_id uuid,
  _contact_id uuid DEFAULT NULL,
  _source text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _org_paused boolean;
  _org_paused_reason text;
  _org_hour_count integer;
  _contact_hour_count integer;
  _last_contact_send timestamptz;
  _org_limit integer := 200;
  _contact_limit integer := 30;
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
    INSERT INTO public.whatsapp_message_log (organization_id, contact_id, source, status, blocked_reason)
    VALUES (_org_id, _contact_id, _source, 'blocked', 'rate_limit_org');

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