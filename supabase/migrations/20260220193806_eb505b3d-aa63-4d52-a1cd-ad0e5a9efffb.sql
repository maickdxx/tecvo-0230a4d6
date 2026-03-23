
-- Create password_reset_codes table for the "forgot password" flow
CREATE TABLE IF NOT EXISTS public.password_reset_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  blocked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS idx_password_reset_codes_email ON public.password_reset_codes(email);

-- Enable RLS
ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

-- Allow anonymous insert (user requests a reset)
CREATE POLICY "Allow anon insert password reset"
  ON public.password_reset_codes
  FOR INSERT
  WITH CHECK (true);

-- Allow anonymous select (to verify the code)
CREATE POLICY "Allow anon select password reset"
  ON public.password_reset_codes
  FOR SELECT
  USING (true);

-- Allow anonymous update (to mark as verified / increment attempts)
CREATE POLICY "Allow anon update password reset"
  ON public.password_reset_codes
  FOR UPDATE
  USING (true);
