-- Allow employees to read channels in their org (needed for inbox/sending)
CREATE POLICY "Employees can view channels in their org"
ON public.whatsapp_channels
FOR SELECT
TO authenticated
USING (
  organization_id = public.get_user_organization_id()
  AND public.has_role(auth.uid(), 'employee'::app_role)
);