
-- Fix the race condition: user_roles is inserted AFTER profiles in handle_new_user
-- So we can't check user_roles from the profiles INSERT trigger.
-- Instead, detect "new owner" by checking if there are NO other profiles in the org.
-- If this is the FIRST profile in the org, it's the owner being created.

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
  v_profile_count integer;
BEGIN
  -- Only fire for the FIRST profile in the org (= the owner/creator)
  -- This avoids the race condition with user_roles (inserted after profiles)
  SELECT COUNT(*) INTO v_profile_count
  FROM public.profiles
  WHERE organization_id = NEW.organization_id;

  -- If more than 1 profile exists, this is an invited member, skip
  IF v_profile_count > 1 THEN
    RETURN NEW;
  END IF;

  -- Fetch org data
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
      'responsible_phone', NEW.whatsapp_personal,
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
        'responsible_phone', NEW.whatsapp_personal,
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
