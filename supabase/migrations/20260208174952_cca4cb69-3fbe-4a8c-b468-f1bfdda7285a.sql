-- Fix search_path for can_create_service function
CREATE OR REPLACE FUNCTION public.can_create_service(org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_plan TEXT;
  org_plan_expires_at TIMESTAMPTZ;
  current_usage INT;
  service_limit INT;
  current_month TEXT;
BEGIN
  -- Get organization plan
  SELECT plan, plan_expires_at INTO org_plan, org_plan_expires_at
  FROM public.organizations
  WHERE id = org_id;

  -- Check if PRO/Essential plan has expired
  IF org_plan IN ('pro', 'essential') AND org_plan_expires_at IS NOT NULL AND org_plan_expires_at < NOW() THEN
    org_plan := 'free';
  END IF;

  -- Pro plan has unlimited services
  IF org_plan = 'pro' THEN
    RETURN TRUE;
  END IF;

  -- Set limit based on plan
  IF org_plan = 'essential' THEN
    service_limit := 50;
  ELSE
    service_limit := 10; -- Free plan
  END IF;

  -- Get current month usage
  current_month := to_char(NOW(), 'YYYY-MM');
  
  SELECT COALESCE(services_created, 0) INTO current_usage
  FROM public.organization_usage
  WHERE organization_id = org_id AND month_year = current_month;

  -- If no usage record exists, they can create
  IF current_usage IS NULL THEN
    RETURN TRUE;
  END IF;

  RETURN current_usage < service_limit;
END;
$$;