-- 1. Add whatsapp_ai_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN whatsapp_ai_enabled boolean DEFAULT true NOT NULL;

-- 2. Migrate data safely
-- If phone is empty/null but whatsapp_personal has data, migrate it to phone.
UPDATE public.profiles 
SET phone = whatsapp_personal 
WHERE (phone IS NULL OR phone = '') 
  AND (whatsapp_personal IS NOT NULL AND whatsapp_personal != '');

-- 3. Update sync function to use phone
CREATE OR REPLACE FUNCTION public.sync_whatsapp_personal_to_org()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Now sync if phone actually changed
  IF NEW.phone IS DISTINCT FROM OLD.phone THEN
    -- Only sync if this user is admin or owner of the org
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id
        AND role IN ('admin', 'owner')
    ) THEN
      UPDATE public.organizations
      SET whatsapp_owner = NEW.phone
      WHERE id = NEW.organization_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Update trigger to watch phone instead of whatsapp_personal
DROP TRIGGER IF EXISTS trg_sync_whatsapp_personal_to_org ON public.profiles;
CREATE TRIGGER trg_sync_phone_to_org
  AFTER UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_whatsapp_personal_to_org();

-- 4. Update handle_new_user to stop using whatsapp_personal
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
  v_phone TEXT;
BEGIN
  v_phone := NEW.raw_user_meta_data->>'phone';

  SELECT * INTO invite_record 
  FROM public.invites
  WHERE email = NEW.email 
    AND accepted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    new_org_id := invite_record.organization_id;
    
    UPDATE public.invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
    
    INSERT INTO public.profiles (
      user_id, organization_id, full_name, phone,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_referrer, first_landing_page
    )
    VALUES (
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', v_phone,
      NEW.raw_user_meta_data->>'utm_source',
      NEW.raw_user_meta_data->>'utm_medium',
      NEW.raw_user_meta_data->>'utm_campaign',
      NEW.raw_user_meta_data->>'referrer',
      NEW.raw_user_meta_data->>'landing_page'
    );
    
    INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (NEW.id, invite_record.role, new_org_id);
  ELSE
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    RETURNING id INTO new_org_id;
    
    -- Set whatsapp_owner on the new org from signup phone
    IF v_phone IS NOT NULL AND v_phone != '' THEN
      UPDATE public.organizations
      SET whatsapp_owner = v_phone
      WHERE id = new_org_id;
    END IF;
    
    INSERT INTO public.profiles (
      user_id, organization_id, full_name, phone,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_referrer, first_landing_page
    )
    VALUES (
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', v_phone,
      NEW.raw_user_meta_data->>'utm_source',
      NEW.raw_user_meta_data->>'utm_medium',
      NEW.raw_user_meta_data->>'utm_campaign',
      NEW.raw_user_meta_data->>'referrer',
      NEW.raw_user_meta_data->>'landing_page'
    );
    
    INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (NEW.id, 'admin', new_org_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 5. Drop the view, then the column, then recreate the view
DROP VIEW IF EXISTS public.profiles_safe;
ALTER TABLE public.profiles DROP COLUMN whatsapp_personal;

CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  organization_id,
  full_name,
  avatar_url,
  "position",
  employee_type,
  field_worker,
  phone,
  created_at,
  updated_at,
  last_access,
  whatsapp_signature_enabled,
  notification_preferences,
  dashboard_layout,
  demo_tour_completed,
  ai_assistant_name,
  ai_assistant_voice,
  whatsapp_ai_enabled
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;
