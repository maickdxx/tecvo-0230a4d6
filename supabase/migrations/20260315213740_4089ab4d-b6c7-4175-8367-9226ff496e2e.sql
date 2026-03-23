
-- 1. Create backup_logs table
CREATE TABLE IF NOT EXISTS public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_path text NOT NULL,
  tables_included text[] NOT NULL DEFAULT '{}',
  record_counts jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  size_bytes bigint
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their org backup logs" ON public.backup_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id() 
    AND public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "Super admins can view all backup logs" ON public.backup_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2. Mass deletion protection trigger
CREATE OR REPLACE FUNCTION public.guard_mass_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_deletes integer;
  caller_id uuid;
BEGIN
  caller_id := auth.uid();
  
  -- Service role (NULL uid) bypasses this check (edge functions with explicit auth)
  IF caller_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- Super admins bypass
  IF public.is_super_admin(caller_id) THEN
    RETURN OLD;
  END IF;

  -- Count deletes on this table for this org in the last 5 seconds
  SELECT COUNT(*) INTO recent_deletes
  FROM public.data_audit_log
  WHERE table_name = TG_TABLE_NAME
    AND organization_id = OLD.organization_id
    AND operation = 'DELETE'
    AND created_at > now() - interval '5 seconds';

  IF recent_deletes >= 5 THEN
    -- Log critical alert
    INSERT INTO public.data_audit_log (
      organization_id, user_id, table_name, operation, metadata
    ) VALUES (
      OLD.organization_id, caller_id, TG_TABLE_NAME, 'MASS_DELETE_BLOCKED',
      jsonb_build_object('blocked_record_id', OLD.id, 'recent_deletes', recent_deletes)
    );
    RAISE EXCEPTION 'Operação bloqueada: deleção em massa detectada (% registros em 5s). Contate o administrador.', recent_deletes;
  END IF;

  RETURN OLD;
END;
$$;

-- Attach to critical business tables
CREATE TRIGGER guard_mass_delete_clients BEFORE DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.guard_mass_delete();

CREATE TRIGGER guard_mass_delete_services BEFORE DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.guard_mass_delete();

CREATE TRIGGER guard_mass_delete_transactions BEFORE DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.guard_mass_delete();
