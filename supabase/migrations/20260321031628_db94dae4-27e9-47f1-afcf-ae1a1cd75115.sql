CREATE OR REPLACE FUNCTION public.check_team_member_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  org_plan TEXT;
  max_users INTEGER;
  current_members INTEGER;
BEGIN
  SELECT COALESCE(plan, 'free') INTO org_plan
  FROM public.organizations
  WHERE id = NEW.organization_id;

  CASE org_plan
    WHEN 'pro' THEN max_users := 999999;
    WHEN 'essential' THEN max_users := 3;
    WHEN 'starter' THEN max_users := 1;
    ELSE max_users := 1;
  END CASE;

  SELECT COUNT(*) INTO current_members
  FROM public.profiles
  WHERE organization_id = NEW.organization_id;

  IF current_members >= max_users THEN
    RAISE EXCEPTION 'Limite de % usuário(s) atingido no seu plano. Faça upgrade para adicionar mais membros.', max_users;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS check_team_member_limit_trigger ON public.profiles;
CREATE TRIGGER check_team_member_limit_trigger
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_team_member_limit();