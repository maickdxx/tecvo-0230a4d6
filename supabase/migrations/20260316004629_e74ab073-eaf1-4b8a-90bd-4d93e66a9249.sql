-- Fix 1: user_roles DELETE policy - add org scope
DROP POLICY "Admins can delete non-owner roles" ON public.user_roles;
CREATE POLICY "Admins can delete non-owner roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND is_same_organization(user_id)
  );

-- Fix 1: user_roles UPDATE policy - add org scope
DROP POLICY "Admins can update non-owner roles" ON public.user_roles;
CREATE POLICY "Admins can update non-owner roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND is_same_organization(user_id)
  )
  WITH CHECK (
    (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
    AND ((role <> 'owner'::app_role) OR has_role(auth.uid(), 'owner'::app_role))
    AND is_same_organization(user_id)
  );

-- Fix 2: whatsapp_channels - restrict SELECT to owner/admin only
DROP POLICY "Users can view channels in their org" ON public.whatsapp_channels;
CREATE POLICY "Admins can view channels in their org" ON public.whatsapp_channels
  FOR SELECT TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Also restrict INSERT/UPDATE/DELETE to owner/admin
DROP POLICY "Users can create channels in their org" ON public.whatsapp_channels;
CREATE POLICY "Admins can create channels in their org" ON public.whatsapp_channels
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY "Users can update channels in their org" ON public.whatsapp_channels;
CREATE POLICY "Admins can update channels in their org" ON public.whatsapp_channels
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY "Users can delete channels in their org" ON public.whatsapp_channels;
CREATE POLICY "Admins can delete channels in their org" ON public.whatsapp_channels
  FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- Fix 3: clients - restrict UPDATE/DELETE to non-employee roles
DROP POLICY "Users can update clients in their organization" ON public.clients;
CREATE POLICY "Users can update clients in their organization" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );

DROP POLICY "Users can delete clients in their organization" ON public.clients;
CREATE POLICY "Users can delete clients in their organization" ON public.clients
  FOR DELETE TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND can_modify(auth.uid())
  );