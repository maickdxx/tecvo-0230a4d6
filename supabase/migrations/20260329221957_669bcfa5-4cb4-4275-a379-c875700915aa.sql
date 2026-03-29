-- 1. Drop the existing permissive policy for users
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- 2. Create a new restrictive policy for users that prevents changing sensitive columns
-- This policy allows users to update their own profile, but only if sensitive columns remain unchanged.
-- The WITH CHECK clause compares the NEW values with the OLD values stored in the table.
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id AND
  (
    SELECT (
      p.hourly_rate, 
      p.cpf, 
      p.rg, 
      p.hire_date, 
      p.employee_type, 
      p.address_cep, 
      p.address_street, 
      p.address_number, 
      p.address_neighborhood, 
      p.address_city, 
      p.address_state, 
      p.notes, 
      p.position, 
      p.field_worker, 
      p.organization_id,
      p.user_id
    )
    FROM public.profiles p
    WHERE p.id = profiles.id
  ) IS NOT DISTINCT FROM (
    hourly_rate, 
    cpf, 
    rg, 
    hire_date, 
    employee_type, 
    address_cep, 
    address_street, 
    address_number, 
    address_neighborhood, 
    address_city, 
    address_state, 
    notes, 
    position, 
    field_worker, 
    organization_id,
    user_id
  )
);

-- 3. Ensure admins and owners can still update everything.
-- The existing policy "Admins can update profiles in their organization" already allows this 
-- because it doesn't have a restrictive WITH CHECK clause (it's permissive).
-- If an admin updates a profile (including their own), they will match this permissive policy.

-- Optional: Update the admin policy to be more explicit if needed, but the current one is fine:
-- current: ((organization_id = get_user_organization_id()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role)))
-- However, there is a small flaw in the current admin policy: get_user_organization_id() might change.
-- But it's outside the scope of "fixing column security" unless it's a security hole.

-- Let's add a small comment explaining the mechanism.
COMMENT ON POLICY "Users can update their own profile" ON public.profiles IS 
'Restricts users from updating sensitive HR and address fields while allowing them to update their own contact and preference data.';
