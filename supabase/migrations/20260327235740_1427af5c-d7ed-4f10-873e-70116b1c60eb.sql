
-- 1. Create trigger function to sync admin's whatsapp_personal to org's whatsapp_owner
CREATE OR REPLACE FUNCTION public.sync_whatsapp_personal_to_org()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync if whatsapp_personal actually changed
  IF NEW.whatsapp_personal IS DISTINCT FROM OLD.whatsapp_personal THEN
    -- Only sync if this user is admin or owner of the org
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id
        AND role IN ('admin', 'owner')
    ) THEN
      UPDATE public.organizations
      SET whatsapp_owner = COALESCE(NULLIF(NEW.whatsapp_personal, ''), NEW.phone)
      WHERE id = NEW.organization_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS trg_sync_whatsapp_personal_to_org ON public.profiles;
CREATE TRIGGER trg_sync_whatsapp_personal_to_org
  AFTER UPDATE OF whatsapp_personal ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_whatsapp_personal_to_org();

-- 3. Update handle_new_user to also set whatsapp_owner on the new org
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
      user_id, organization_id, full_name, phone, whatsapp_personal,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_referrer, first_landing_page
    )
    VALUES (
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', v_phone,
      CASE WHEN v_phone IS NOT NULL AND v_phone != '' THEN v_phone ELSE NULL END,
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
      user_id, organization_id, full_name, phone, whatsapp_personal,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_referrer, first_landing_page
    )
    VALUES (
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', v_phone,
      CASE WHEN v_phone IS NOT NULL AND v_phone != '' THEN v_phone ELSE NULL END,
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
