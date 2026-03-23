
-- Bots table
CREATE TABLE public.whatsapp_bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  trigger_config JSONB DEFAULT '{}',
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_bots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bots in their org"
ON public.whatsapp_bots
FOR ALL
TO authenticated
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

-- Bot steps (nodes)
CREATE TABLE public.whatsapp_bot_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.whatsapp_bots(id) ON DELETE CASCADE,
  step_type TEXT NOT NULL,
  label TEXT,
  config JSONB DEFAULT '{}',
  position_x FLOAT DEFAULT 0,
  position_y FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_bot_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bot steps via bot org"
ON public.whatsapp_bot_steps
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.whatsapp_bots b WHERE b.id = bot_id AND b.organization_id = public.get_user_organization_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_bots b WHERE b.id = bot_id AND b.organization_id = public.get_user_organization_id()));

-- Connections between steps
CREATE TABLE public.whatsapp_bot_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.whatsapp_bots(id) ON DELETE CASCADE,
  from_step_id UUID NOT NULL REFERENCES public.whatsapp_bot_steps(id) ON DELETE CASCADE,
  to_step_id UUID NOT NULL REFERENCES public.whatsapp_bot_steps(id) ON DELETE CASCADE,
  condition_branch TEXT DEFAULT 'default'
);

ALTER TABLE public.whatsapp_bot_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bot connections via bot org"
ON public.whatsapp_bot_connections
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.whatsapp_bots b WHERE b.id = bot_id AND b.organization_id = public.get_user_organization_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_bots b WHERE b.id = bot_id AND b.organization_id = public.get_user_organization_id()));

-- Bot executions (active runs)
CREATE TABLE public.whatsapp_bot_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.whatsapp_bots(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES public.whatsapp_bot_steps(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'running',
  wait_until TIMESTAMPTZ,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.whatsapp_bot_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bot executions in their org"
ON public.whatsapp_bot_executions
FOR ALL
TO authenticated
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

-- Execution logs
CREATE TABLE public.whatsapp_bot_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES public.whatsapp_bot_executions(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.whatsapp_bot_steps(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_bot_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view execution logs via execution org"
ON public.whatsapp_bot_execution_logs
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.whatsapp_bot_executions e WHERE e.id = execution_id AND e.organization_id = public.get_user_organization_id()))
WITH CHECK (EXISTS (SELECT 1 FROM public.whatsapp_bot_executions e WHERE e.id = execution_id AND e.organization_id = public.get_user_organization_id()));
