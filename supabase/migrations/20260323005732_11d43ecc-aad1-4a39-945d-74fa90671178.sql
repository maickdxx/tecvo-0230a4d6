CREATE OR REPLACE FUNCTION public.check_channel_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  channel_count INTEGER;
  org_plan TEXT;
  max_channels INTEGER;
BEGIN
  SELECT COALESCE(plan, 'free') INTO org_plan
  FROM public.organizations
  WHERE id = NEW.organization_id;

  CASE org_plan
    WHEN 'pro' THEN max_channels := 5;
    WHEN 'essential' THEN max_channels := 2;
    WHEN 'starter' THEN max_channels := 0;
    ELSE max_channels := 0;
  END CASE;

  SELECT COUNT(*) INTO channel_count
  FROM public.whatsapp_channels
  WHERE organization_id = NEW.organization_id
    AND channel_type = 'CUSTOMER_INBOX'
    AND COALESCE(channel_status, 'disconnected') NOT IN ('deleted', 'deleting');

  IF channel_count >= max_channels THEN
    RAISE EXCEPTION 'Limite de % canal(is) de WhatsApp atingido no seu plano', max_channels;
  END IF;

  RETURN NEW;
END;
$function$;