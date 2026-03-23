-- Fix 2: Restrict profiles SELECT so regular employees only see their own profile
-- Admins/owners can still see all org profiles

DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_super_admin(auth.uid())
    OR (
      organization_id = get_user_organization_id()
      AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    )
  );