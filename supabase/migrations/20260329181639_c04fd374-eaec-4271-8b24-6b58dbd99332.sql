
CREATE OR REPLACE FUNCTION public.notify_service_milestones()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  svc_count INTEGER;
  org_name TEXT;
  base_url text := 'https://vcuwimodpfbzpuvzesfm.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s';
BEGIN
  -- Skip demo data services entirely
  IF NEW.is_demo_data = true THEN
    RETURN NEW;
  END IF;

  -- Count only REAL (non-demo) services
  SELECT COUNT(*) INTO svc_count
  FROM public.services
  WHERE organization_id = NEW.organization_id
    AND deleted_at IS NULL
    AND is_demo_data = false;

  SELECT name INTO org_name FROM public.organizations WHERE id = NEW.organization_id;

  IF svc_count = 1 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('first_service', '🎯 Primeiro serviço criado: ' || org_name, jsonb_build_object('org_name', org_name), NEW.organization_id);

    BEGIN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/admin-notify',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key),
        body := jsonb_build_object('type', 'first_service', 'org_id', NEW.organization_id, 'org_name', org_name)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_service_milestones http call failed: %', SQLERRM;
    END;
  END IF;

  IF svc_count = 100 THEN
    INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
    VALUES ('milestone_100', '🏆 100 serviços atingidos: ' || org_name, jsonb_build_object('org_name', org_name, 'count', 100), NEW.organization_id);

    BEGIN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/admin-notify',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key),
        body := jsonb_build_object('type', 'milestone_100', 'org_id', NEW.organization_id, 'org_name', org_name)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_service_milestones http call failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$function$;
