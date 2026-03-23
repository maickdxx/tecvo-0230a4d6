
CREATE OR REPLACE FUNCTION public.notify_new_organization()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_url text;
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

  -- Try to call edge function, but don't fail if settings are missing
  BEGIN
    base_url := current_setting('app.settings.supabase_url', true);
    IF base_url IS NOT NULL AND base_url != '' THEN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/admin-notify',
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
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_new_organization http call failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

-- Also fix notify_service_milestones and notify_plan_changes with same pattern
CREATE OR REPLACE FUNCTION public.notify_service_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  svc_count INTEGER;
  org_name TEXT;
  base_url TEXT;
BEGIN
  SELECT COUNT(*) INTO svc_count FROM public.services WHERE organization_id = NEW.organization_id AND deleted_at IS NULL;
  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;

  IF svc_count = 1 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('first_service', '🎯 Primeiro serviço criado: ' || org_name, jsonb_build_object('org_name', org_name), NEW.organization_id);

    BEGIN
      base_url := current_setting('app.settings.supabase_url', true);
      IF base_url IS NOT NULL AND base_url != '' THEN
        PERFORM net.http_post(
          url := base_url || '/functions/v1/admin-notify',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
          body := jsonb_build_object('type', 'first_service', 'org_id', NEW.organization_id, 'org_name', org_name)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_service_milestones http call failed: %', SQLERRM;
    END;
  END IF;

  IF svc_count = 100 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('milestone_100', '🏆 100 serviços atingidos: ' || org_name, jsonb_build_object('org_name', org_name, 'count', 100), NEW.organization_id);

    BEGIN
      base_url := current_setting('app.settings.supabase_url', true);
      IF base_url IS NOT NULL AND base_url != '' THEN
        PERFORM net.http_post(
          url := base_url || '/functions/v1/admin-notify',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
          body := jsonb_build_object('type', 'milestone_100', 'org_id', NEW.organization_id, 'org_name', org_name)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_service_milestones http call failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_plan_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_url TEXT;
BEGIN
  IF NEW.cancel_at_period_end = true AND (OLD.cancel_at_period_end IS NULL OR OLD.cancel_at_period_end = false) THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('cancellation_attempt', '⚠️ Tentativa de cancelamento: ' || NEW.name, jsonb_build_object('org_name', NEW.name, 'plan', NEW.plan), NEW.id);

    BEGIN
      base_url := current_setting('app.settings.supabase_url', true);
      IF base_url IS NOT NULL AND base_url != '' THEN
        PERFORM net.http_post(
          url := base_url || '/functions/v1/admin-notify',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
          body := jsonb_build_object('type', 'cancellation_attempt', 'org_id', NEW.id, 'org_name', NEW.name, 'plan', NEW.plan)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_plan_changes http call failed: %', SQLERRM;
    END;
  END IF;

  IF OLD.plan IS NOT NULL AND OLD.plan != 'free' AND (NEW.plan = 'free' OR NEW.plan IS NULL) THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('plan_expired', '💳 Plano expirado: ' || NEW.name, jsonb_build_object('org_name', NEW.name, 'old_plan', OLD.plan), NEW.id);

    BEGIN
      base_url := current_setting('app.settings.supabase_url', true);
      IF base_url IS NOT NULL AND base_url != '' THEN
        PERFORM net.http_post(
          url := base_url || '/functions/v1/admin-notify',
          headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
          body := jsonb_build_object('type', 'plan_expired', 'org_id', NEW.id, 'org_name', NEW.name, 'old_plan', OLD.plan)
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_plan_changes http call failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
