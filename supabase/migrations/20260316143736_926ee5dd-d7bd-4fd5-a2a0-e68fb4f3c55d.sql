-- Fix 1: Prevent admin from assigning super_admin role
-- The condition (role <> 'owner') allows super_admin since super_admin != owner
-- Add explicit block for super_admin in admin INSERT, UPDATE, and DELETE policies

-- DROP and recreate INSERT policy
DROP POLICY IF EXISTS "Admins can insert non-owner roles in same org" ON public.user_roles;
CREATE POLICY "Admins can insert non-owner roles in same org"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (role <> 'super_admin'::app_role)
    AND is_same_organization(user_id)
  );

-- DROP and recreate UPDATE policy
DROP POLICY IF EXISTS "Admins can update non-owner roles" ON public.user_roles;
CREATE POLICY "Admins can update non-owner roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (role <> 'super_admin'::app_role)
    AND is_same_organization(user_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (role <> 'super_admin'::app_role)
    AND is_same_organization(user_id)
  );

-- DROP and recreate DELETE policy
DROP POLICY IF EXISTS "Admins can delete non-owner roles" ON public.user_roles;
CREATE POLICY "Admins can delete non-owner roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND (role <> 'super_admin'::app_role)
    AND is_same_organization(user_id)
  );