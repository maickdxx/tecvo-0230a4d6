
-- Table for OTP verification codes
CREATE TABLE public.email_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service_role) full access, and anon can insert/select by email
CREATE POLICY "Allow anon insert" ON public.email_verifications
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anon select" ON public.email_verifications
  FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update" ON public.email_verifications
  FOR UPDATE TO anon USING (true);

-- Index for quick lookup
CREATE INDEX idx_email_verifications_email_code ON public.email_verifications (email, code);
