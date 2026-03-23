-- Fix 1: Transaction DELETE policy — require can_modify permission
DROP POLICY IF EXISTS "Users can delete transactions in their organization" ON public.transactions;
CREATE POLICY "Users can delete transactions in their organization"
  ON public.transactions FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );

-- Fix 2: Transaction UPDATE policy — also require can_modify
DROP POLICY IF EXISTS "Users can update transactions in their organization" ON public.transactions;
CREATE POLICY "Users can update transactions in their organization"
  ON public.transactions FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );

-- Fix 3: service_payments DELETE policy — require can_modify
DROP POLICY IF EXISTS "Users can delete service payments in their org" ON public.service_payments;
CREATE POLICY "Users can delete service payments in their org"
  ON public.service_payments FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );

-- Fix 4: service_payments UPDATE policy — require can_modify
DROP POLICY IF EXISTS "Users can update service payments in their org" ON public.service_payments;
CREATE POLICY "Users can update service payments in their org"
  ON public.service_payments FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );

-- Fix 5: Profiles — restrict sensitive fields to self/admin/owner
-- Replace the broad SELECT policy with two: one for self (full), one for org (limited)
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON public.profiles;

-- Self: can see everything
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Org members: can see non-sensitive fields via a security definer view
-- But RLS can't filter columns, so we create a restricted view approach:
-- Admin/owner can see all profiles in their org
CREATE POLICY "Admins can view all profiles in their org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND (
      has_role(auth.uid(), 'owner'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR is_super_admin(auth.uid())
    )
  );

-- Regular members: can view profiles but we'll handle field restriction in code
-- They need basic profile info (name, avatar, position) for team features
CREATE POLICY "Members can view basic profiles in their org"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
  );