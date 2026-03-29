-- Update notify_new_organization to use phone instead of whatsapp_personal
CREATE OR REPLACE FUNCTION public.notify_new_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_url text := 'https://vcuwimodpfbzpuvzesfm.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s';
  v_org RECORD;
  v_user_email text;
  v_role text;
BEGIN
  -- Only fire for owner role (new org creation, not invite acceptance)
  SELECT role INTO v_role FROM public.user_roles WHERE user_id = NEW.user_id AND organization_id = NEW.organization_id LIMIT 1;
  IF v_role IS DISTINCT FROM 'owner' THEN
    RETURN NEW;
  END IF;

  -- Fetch org data (now guaranteed to exist)
  SELECT id, name, email, phone, plan, created_at INTO v_org
  FROM public.organizations WHERE id = NEW.organization_id;

  -- Fetch user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = NEW.user_id;

  -- Insert platform notification with complete data
  INSERT INTO public.platform_admin_notifications (notification_type, title, metadata, organization_id)
  VALUES (
    'new_account',
    '🚀 Nova empresa cadastrada: ' || COALESCE(v_org.name, 'Sem nome'),
    jsonb_build_object(
      'org_name', v_org.name,
      'responsible_name', NEW.full_name,
      'responsible_email', v_user_email,
      'responsible_phone', NEW.phone,
      'org_email', v_org.email,
      'org_phone', v_org.phone,
      'plan', COALESCE(v_org.plan, 'trial'),
      'created_at', v_org.created_at
    ),
    NEW.organization_id
  );

  -- HTTP call to admin-notify with complete data
  BEGIN
    PERFORM net.http_post(
      url := base_url || '/functions/v1/admin-notify',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'type', 'new_account',
        'org_id', NEW.organization_id,
        'org_name', v_org.name,
        'org_email', v_org.email,
        'org_phone', v_org.phone,
        'responsible_name', NEW.full_name,
        'responsible_email', v_user_email,
        'responsible_phone', NEW.phone,
        'plan', COALESCE(v_org.plan, 'trial'),
        'created_at', v_org.created_at::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_new_organization http call failed: %', SQLERRM;
  END;

  -- Dispatch welcome via edge function
  BEGIN
    PERFORM net.http_post(
      url := base_url || '/functions/v1/dispatch-welcome',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id,
        'organization_id', NEW.organization_id
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'dispatch-welcome http call failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$function$;
