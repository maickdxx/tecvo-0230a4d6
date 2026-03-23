
-- Remove overly permissive public RLS policies on password_reset_codes
DROP POLICY IF EXISTS "Allow anon insert password reset" ON public.password_reset_codes;
DROP POLICY IF EXISTS "Allow anon select password reset" ON public.password_reset_codes;
DROP POLICY IF EXISTS "Allow anon update password reset" ON public.password_reset_codes;

-- No new policies needed: edge functions use service_role which bypasses RLS
