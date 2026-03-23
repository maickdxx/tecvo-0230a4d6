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
  SELECT plan, plan_expires_at INTO org_plan, org_plan_expires_at
  FROM public.organizations
  WHERE id = org_id;

  -- Check if paid plan has expired
  IF org_plan IS NOT NULL AND org_plan != 'free' AND org_plan_expires_at IS NOT NULL AND org_plan_expires_at < NOW() THEN
    org_plan := 'free';
  END IF;

  -- Pro plan has unlimited services
  IF org_plan = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Set limit based on plan
  IF org_plan = 'essential' THEN
    service_limit := 50;
  ELSIF org_plan = 'starter' THEN
    service_limit := 15;
  ELSE
    service_limit := 10; -- Free plan
  END IF;

  -- Get current month usage
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