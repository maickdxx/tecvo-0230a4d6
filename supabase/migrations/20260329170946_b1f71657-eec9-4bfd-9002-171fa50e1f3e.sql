
-- Campaign queue table for controlled re-engagement sends
CREATE TABLE public.campaign_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_name TEXT NOT NULL DEFAULT 'reengagement',
  user_id UUID NOT NULL,
  organization_id UUID,
  phone TEXT,
  email TEXT,
  user_name TEXT,
  message_template TEXT NOT NULL,
  email_template TEXT,
  email_subject TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  whatsapp_status TEXT DEFAULT 'pending',
  email_status TEXT DEFAULT 'pending',
  whatsapp_error TEXT,
  email_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campaign config for rate limits
CREATE TABLE public.campaign_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  sends_per_hour INTEGER NOT NULL DEFAULT 20,
  min_interval_seconds INTEGER NOT NULL DEFAULT 120,
  max_interval_seconds INTEGER NOT NULL DEFAULT 300,
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_reason TEXT,
  cooldown_hours INTEGER NOT NULL DEFAULT 72,
  current_campaign TEXT DEFAULT 'reengagement',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default config
INSERT INTO public.campaign_config (id, sends_per_hour, min_interval_seconds, max_interval_seconds, is_paused, cooldown_hours)
VALUES (1, 20, 120, 300, false, 72);

-- Index for queue processing
CREATE INDEX idx_campaign_sends_status ON public.campaign_sends (status, priority DESC, created_at ASC);
CREATE INDEX idx_campaign_sends_user ON public.campaign_sends (user_id, campaign_name);

-- Enable RLS
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_config ENABLE ROW LEVEL SECURITY;

-- RLS: service role only (edge functions)
CREATE POLICY "Service role full access on campaign_sends" ON public.campaign_sends
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on campaign_config" ON public.campaign_config
  FOR ALL USING (true) WITH CHECK (true);
