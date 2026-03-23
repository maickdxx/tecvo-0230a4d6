
-- Client portal sessions for OTP and direct access tokens
CREATE TABLE public.client_portal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  otp_code text,
  otp_expires_at timestamptz,
  otp_attempts integer DEFAULT 0,
  session_token uuid DEFAULT gen_random_uuid(),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  is_verified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for quick lookups
CREATE INDEX idx_client_portal_phone ON public.client_portal_sessions(phone);
CREATE INDEX idx_client_portal_token ON public.client_portal_sessions(session_token);

-- Enable RLS
ALTER TABLE public.client_portal_sessions ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed for client-facing queries — 
-- all access goes through edge functions with service_role key.
-- The session_token acts as the authentication mechanism.
