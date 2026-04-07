-- User notification preferences (Laura preferences)
CREATE TABLE public.user_notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Service notifications
  service_started BOOLEAN NOT NULL DEFAULT true,
  service_completed BOOLEAN NOT NULL DEFAULT true,
  service_en_route BOOLEAN NOT NULL DEFAULT true,
  -- Agenda
  schedule_reminder BOOLEAN NOT NULL DEFAULT true,
  -- Operational
  operational_alerts BOOLEAN NOT NULL DEFAULT true,
  -- Laura personal
  laura_tips BOOLEAN NOT NULL DEFAULT true,
  -- Channels
  channel_whatsapp BOOLEAN NOT NULL DEFAULT true,
  channel_internal BOOLEAN NOT NULL DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON public.user_notification_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences"
  ON public.user_notification_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences"
  ON public.user_notification_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Dispatch log for audit trail
CREATE TABLE public.notification_dispatch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  organization_id UUID NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  preference_value BOOLEAN,
  action TEXT NOT NULL, -- 'sent', 'blocked', 'no_phone', 'no_preference'
  reason TEXT,
  service_id UUID,
  executor_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dispatch logs"
  ON public.notification_dispatch_log FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_notification_dispatch_log_user ON public.notification_dispatch_log(user_id, created_at DESC);
CREATE INDEX idx_notification_dispatch_log_org ON public.notification_dispatch_log(organization_id, created_at DESC);
CREATE INDEX idx_user_notification_preferences_user ON public.user_notification_preferences(user_id);
