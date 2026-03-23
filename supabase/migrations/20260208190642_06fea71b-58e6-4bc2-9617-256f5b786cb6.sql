-- Create function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Update organizations policy to allow super admins to view ALL organizations
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;

CREATE POLICY "Users can view their organization" ON organizations
FOR SELECT
USING (
  id = get_user_organization_id() 
  OR is_super_admin(auth.uid())
);

-- Allow super admins to update any organization
DROP POLICY IF EXISTS "Users can update their organization" ON organizations;

CREATE POLICY "Users can update their organization" ON organizations
FOR UPDATE
USING (
  id = get_user_organization_id() 
  OR is_super_admin(auth.uid())
);

-- Allow super admins to delete organizations
CREATE POLICY "Super admins can delete organizations" ON organizations
FOR DELETE
USING (is_super_admin(auth.uid()));

-- Allow super admins to view all profiles
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;

CREATE POLICY "Users can view profiles in their organization" ON profiles
FOR SELECT
USING (
  organization_id = get_user_organization_id() 
  OR is_super_admin(auth.uid())
);

-- Update user_roles policy to allow super admins to view all roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

CREATE POLICY "Users can view their own roles" ON user_roles
FOR SELECT
USING (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
);