
-- Table to store AI verification PINs for TECVO_AI channel security
CREATE TABLE public.whatsapp_ai_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pin_hash TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.whatsapp_ai_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org AI pins"
  ON public.whatsapp_ai_pins FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage their org AI pins"
  ON public.whatsapp_ai_pins FOR ALL
  USING (organization_id = get_user_organization_id() AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')))
  WITH CHECK (organization_id = get_user_organization_id() AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')));

-- Add column to track AI verification state per session in webhook
-- This tracks which phone numbers have been verified in the current 24h window
CREATE TABLE public.whatsapp_ai_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_ai_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role accesses this table (from edge functions)
-- No user-facing policies needed

-- Index for fast lookup
CREATE INDEX idx_whatsapp_ai_sessions_lookup 
  ON public.whatsapp_ai_sessions(organization_id, phone_number, expires_at);

-- Add audit log for AI financial actions
ALTER TABLE public.whatsapp_messages 
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
