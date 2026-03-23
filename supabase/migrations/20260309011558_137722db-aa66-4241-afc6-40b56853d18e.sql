
-- AI Usage Logs table for monitoring AI consumption
CREATE TABLE public.ai_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  action_slug TEXT NOT NULL,
  model TEXT,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_ai_usage_logs_org_created ON public.ai_usage_logs(organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_logs_action ON public.ai_usage_logs(action_slug, created_at DESC);
CREATE INDEX idx_ai_usage_logs_created ON public.ai_usage_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- Super admins can read all logs
CREATE POLICY "Super admins can read all ai_usage_logs"
ON public.ai_usage_logs FOR SELECT
TO authenticated
USING (public.is_super_admin(auth.uid()));

-- Service role can insert (edge functions)
CREATE POLICY "Service role can insert ai_usage_logs"
ON public.ai_usage_logs FOR INSERT
TO service_role
WITH CHECK (true);
