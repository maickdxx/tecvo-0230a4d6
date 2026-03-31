
-- 1. Fix handle_new_user to assign 'owner' role for new org creators
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    
    -- FIXED: assign 'owner' role (not 'admin') for new org creators
    INSERT INTO public.user_roles (user_id, role, organization_id)
    VALUES (NEW.id, 'owner', new_org_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Fix Guillermo's role from admin to owner
UPDATE public.user_roles 
SET role = 'owner' 
WHERE user_id = '43066d21-3de5-4ee9-ae0c-388299b532ed' 
  AND role = 'admin';

-- 3. Fix any other org creators who got 'admin' instead of 'owner'
-- Find users who are the only member of their org with 'admin' role and no 'owner' exists
UPDATE public.user_roles ur
SET role = 'owner'
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2 
    WHERE ur2.organization_id = ur.organization_id 
      AND ur2.role = 'owner'
  );
