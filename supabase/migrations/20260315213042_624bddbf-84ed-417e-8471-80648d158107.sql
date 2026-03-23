
-- 1. Create data_audit_log table
CREATE TABLE IF NOT EXISTS public.data_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id uuid,
  table_name text NOT NULL,
  operation text NOT NULL,
  record_id uuid,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.data_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read all audit logs" ON public.data_audit_log
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Owners can read their org audit logs" ON public.data_audit_log
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.has_role(auth.uid(), 'owner'));

-- 2. Create audit trigger function
CREATE OR REPLACE FUNCTION public.audit_destructive_operation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.data_audit_log (organization_id, user_id, table_name, operation, record_id, old_data)
    VALUES (
      OLD.organization_id,
      auth.uid(),
      TG_TABLE_NAME,
      'DELETE',
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.data_audit_log (organization_id, user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (
      NEW.organization_id,
      auth.uid(),
      TG_TABLE_NAME,
      'UPDATE',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- 3. Audit triggers on critical tables
CREATE TRIGGER audit_clients_delete AFTER DELETE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_services_delete AFTER DELETE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_transactions_delete AFTER DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_financial_accounts_delete AFTER DELETE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_organizations_delete AFTER DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_profiles_delete AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

CREATE TRIGGER audit_user_roles_delete AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_destructive_operation();

-- 4. Fix email_verifications: Remove dangerous anon policies
DROP POLICY IF EXISTS "Allow anon select" ON public.email_verifications;
DROP POLICY IF EXISTS "Allow anon insert" ON public.email_verifications;
DROP POLICY IF EXISTS "Allow anon update" ON public.email_verifications;

-- 5. Fix webchat_configs enumeration: Replace open anon policy with RPC
DROP POLICY IF EXISTS "Public can read active webchat configs by org id" ON public.webchat_configs;

CREATE OR REPLACE FUNCTION public.get_webchat_config(_org_id uuid)
RETURNS TABLE (
  config_id uuid,
  org_id uuid,
  is_active boolean,
  pos text,
  color text,
  button_text text,
  welcome_message text,
  display_name text,
  avatar_url text,
  auto_show_welcome boolean,
  bottom_distance integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, organization_id, is_active, "position", color, button_text, 
         welcome_message, display_name, avatar_url, auto_show_welcome, bottom_distance
  FROM public.webchat_configs
  WHERE organization_id = _org_id AND is_active = true
  LIMIT 1;
$$;

-- 6. Fix user_roles cross-org escalation
DROP POLICY IF EXISTS "Admins can insert non-owner roles" ON public.user_roles;

CREATE POLICY "Admins can insert non-owner roles in same org" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    (
      (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
      AND (role <> 'owner'::app_role OR public.has_role(auth.uid(), 'owner'))
      AND public.is_same_organization(user_id)
    )
  );
