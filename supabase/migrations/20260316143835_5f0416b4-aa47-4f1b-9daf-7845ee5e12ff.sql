-- Revert profiles policy - org-wide access is required for team management features
-- The app has 21+ files querying profiles across the organization
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id()
    OR is_super_admin(auth.uid())
  );