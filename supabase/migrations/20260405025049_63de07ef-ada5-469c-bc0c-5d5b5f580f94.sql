
CREATE TABLE public.lead_followups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  first_contact_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_followup_at TIMESTAMPTZ,
  last_followup_sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lead_followups_unique UNIQUE (phone, organization_id, channel_id)
);

ALTER TABLE public.lead_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lead_followups"
ON public.lead_followups
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_lead_followups_status_next ON public.lead_followups (status, next_followup_at);
CREATE INDEX idx_lead_followups_phone_org ON public.lead_followups (phone, organization_id);
