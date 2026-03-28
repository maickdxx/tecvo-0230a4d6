
-- Trigger to enforce single owner per organization
CREATE OR REPLACE FUNCTION public.enforce_single_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'owner' THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE organization_id = NEW.organization_id
        AND role = 'owner'
        AND user_id != NEW.user_id
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe um owner nesta organização. Apenas um owner é permitido por empresa.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_enforce_single_owner
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_owner();

-- Also add a partial unique index as a hard constraint backup
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_owner_per_org
  ON public.user_roles (organization_id)
  WHERE role = 'owner';
