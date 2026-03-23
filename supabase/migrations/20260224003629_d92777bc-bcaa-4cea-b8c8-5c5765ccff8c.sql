
-- Table to log all Super Admin notifications
CREATE TABLE public.platform_admin_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}',
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No RLS needed — only accessed by server-side functions
ALTER TABLE public.platform_admin_notifications ENABLE ROW LEVEL SECURITY;

-- Only super admins can read
CREATE POLICY "Super admins can read notifications"
  ON public.platform_admin_notifications
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Trigger function: notify on new organization created
CREATE OR REPLACE FUNCTION public.notify_new_organization()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Insert notification log
  INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
  VALUES (
    'new_account',
    '🚀 Nova empresa cadastrada: ' || NEW.name,
    jsonb_build_object(
      'org_name', NEW.name,
      'org_email', NEW.email,
      'org_phone', NEW.phone,
      'plan', COALESCE(NEW.plan, 'trial'),
      'created_at', NEW.created_at
    ),
    NEW.id
  );

  -- Call edge function to send email (async via pg_net)
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/admin-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'new_account',
      'org_id', NEW.id,
      'org_name', NEW.name,
      'org_email', NEW.email,
      'org_phone', NEW.phone,
      'plan', COALESCE(NEW.plan, 'trial'),
      'created_at', NEW.created_at::text
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_organization
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_organization();

-- Trigger function: notify on first service + 100 services milestone
CREATE OR REPLACE FUNCTION public.notify_service_milestones()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  svc_count INTEGER;
  org_name TEXT;
BEGIN
  SELECT COUNT(*) INTO svc_count FROM public.services WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;

  -- First service
  IF svc_count = 1 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('first_service', '🎯 Primeiro serviço criado: ' || org_name, jsonb_build_object('org_name', org_name), NEW.organization_id);

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/admin-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object('type', 'first_service', 'org_id', NEW.organization_id, 'org_name', org_name)
    );
  END IF;

  -- 100 services milestone
  IF svc_count = 100 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('milestone_100', '🏆 100 serviços atingidos: ' || org_name, jsonb_build_object('org_name', org_name, 'count', 100), NEW.organization_id);

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/admin-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object('type', 'milestone_100', 'org_id', NEW.organization_id, 'org_name', org_name)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_service_milestones
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_milestones();

-- Trigger: plan cancellation / expiration
CREATE OR REPLACE FUNCTION public.notify_plan_changes()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Cancel at period end toggled on
  IF NEW.cancel_at_period_end = true AND (OLD.cancel_at_period_end IS NULL OR OLD.cancel_at_period_end = false) THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('cancellation_attempt', '⚠️ Tentativa de cancelamento: ' || NEW.name, jsonb_build_object('org_name', NEW.name, 'plan', NEW.plan), NEW.id);

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/admin-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object('type', 'cancellation_attempt', 'org_id', NEW.id, 'org_name', NEW.name, 'plan', NEW.plan)
    );
  END IF;

  -- Plan expired (was paid, now free or expired)
  IF OLD.plan IS NOT NULL AND OLD.plan != 'free' AND (NEW.plan = 'free' OR NEW.plan IS NULL) THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('plan_expired', '💳 Plano expirado: ' || NEW.name, jsonb_build_object('org_name', NEW.name, 'old_plan', OLD.plan), NEW.id);

    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/admin-notify',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object('type', 'plan_expired', 'org_id', NEW.id, 'org_name', NEW.name, 'old_plan', OLD.plan)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_plan_changes
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_plan_changes();

-- Enable pg_net extension (required for async HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
