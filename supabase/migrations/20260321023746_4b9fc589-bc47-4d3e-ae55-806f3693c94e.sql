
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
  -- Get org plan
  SELECT COALESCE(plan, 'free') INTO org_plan
  FROM public.organizations
  WHERE id = NEW.organization_id;

  -- Determine max channels based on plan
  -- starter/free = 0 (no WhatsApp)
  -- essential (Pro) = 2
  -- pro (Empresa) = 5
  CASE org_plan
    WHEN 'pro' THEN max_channels := 5;
    WHEN 'essential' THEN max_channels := 2;
    WHEN 'starter' THEN max_channels := 0;
    ELSE max_channels := 0;
  END CASE;

  SELECT COUNT(*) INTO channel_count
  FROM public.whatsapp_channels
  WHERE organization_id = NEW.organization_id;
  
  IF channel_count >= max_channels THEN
    RAISE EXCEPTION 'Limite de % canal(is) de WhatsApp atingido no seu plano', max_channels;
  END IF;
  
  RETURN NEW;
END;
$function$;
