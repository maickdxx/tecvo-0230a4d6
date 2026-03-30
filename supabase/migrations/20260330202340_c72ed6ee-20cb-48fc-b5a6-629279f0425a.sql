CREATE POLICY "Users can insert own org transitions"
ON public.whatsapp_channel_transitions
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_organization_id());