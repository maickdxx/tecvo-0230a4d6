CREATE POLICY "Users can insert audit logs for their org"
ON public.data_audit_log
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_organization_id());