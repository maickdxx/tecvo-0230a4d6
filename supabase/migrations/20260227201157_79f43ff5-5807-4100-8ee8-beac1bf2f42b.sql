
CREATE POLICY "Super admins can view all notification tokens"
ON public.notification_tokens FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));
