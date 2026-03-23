-- Add back org-level SELECT for profiles since many features need team member names
CREATE POLICY "Members can view profiles in their org"
  ON public.profiles FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

-- Create a security definer function for safely fetching team members without sensitive data
-- "position" is a reserved word, quote it
CREATE OR REPLACE FUNCTION public.get_team_profiles_safe(org_id uuid)
RETURNS TABLE(
  profile_id uuid,
  profile_user_id uuid,
  profile_organization_id uuid,
  profile_full_name text,
  profile_avatar_url text,
  profile_position text,
  profile_employee_type text,
  profile_field_worker boolean,
  profile_phone text,
  profile_last_access timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.user_id, p.organization_id, p.full_name, p.avatar_url,
    p."position", p.employee_type, p.field_worker, p.phone, p.last_access
  FROM public.profiles p
  WHERE p.organization_id = org_id;
$$;