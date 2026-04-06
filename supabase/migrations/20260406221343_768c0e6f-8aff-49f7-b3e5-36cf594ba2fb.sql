
CREATE TABLE public.ai_response_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  channel TEXT NOT NULL DEFAULT 'app',
  user_question TEXT NOT NULL,
  ai_response TEXT NOT NULL,
  numbers_cited JSONB DEFAULT '[]',
  data_source TEXT,
  period_considered TEXT,
  is_total_or_partial TEXT DEFAULT 'unknown',
  had_limit BOOLEAN DEFAULT false,
  had_truncation BOOLEAN DEFAULT false,
  classification TEXT NOT NULL DEFAULT 'unknown',
  context_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_response_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view audit logs"
  ON public.ai_response_audit FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE INDEX idx_ai_response_audit_org ON public.ai_response_audit(organization_id);
CREATE INDEX idx_ai_response_audit_created ON public.ai_response_audit(created_at DESC);
CREATE INDEX idx_ai_response_audit_classification ON public.ai_response_audit(classification);
