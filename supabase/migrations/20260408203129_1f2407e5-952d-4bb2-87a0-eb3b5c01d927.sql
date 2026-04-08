CREATE TABLE public.pending_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.pending_choices ENABLE ROW LEVEL SECURITY;

-- No public access — only service_role uses this table
-- RLS is enabled but no policies = blocked for anon/authenticated by default

CREATE INDEX idx_pending_choices_lookup ON public.pending_choices (organization_id, contact_id, status, expires_at);