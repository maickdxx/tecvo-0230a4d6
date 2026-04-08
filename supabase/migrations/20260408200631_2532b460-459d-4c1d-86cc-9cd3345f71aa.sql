-- Table for pending financial confirmations (hard gate)
CREATE TABLE public.pending_finance_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('approve', 'reject')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text NOT NULL,
  contact_id uuid,
  conversation_id uuid,
  channel text NOT NULL DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  executed_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'expired', 'cancelled'))
);

ALTER TABLE public.pending_finance_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pending actions in their org"
  ON public.pending_finance_actions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create pending actions in their org"
  ON public.pending_finance_actions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update pending actions in their org"
  ON public.pending_finance_actions FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Index for fast lookup of active pending actions
CREATE INDEX idx_pending_finance_active 
  ON public.pending_finance_actions (organization_id, status, expires_at)
  WHERE status = 'pending';