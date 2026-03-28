
-- 1. Fix handle_new_user: assign 'owner' instead of 'admin' for new org creators
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
    INSERT INTO public.organizations (name, whatsapp_owner)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      CASE WHEN v_phone IS NOT NULL AND v_phone != '' THEN v_phone ELSE NULL END
    )
    RETURNING id INTO new_org_id;
    
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
    VALUES (NEW.id, 'owner', new_org_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- 2. Fix existing data: promote earliest admin to owner where no owner exists
WITH orgs_without_owner AS (
  SELECT DISTINCT ur.organization_id
  FROM public.user_roles ur
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.organization_id = ur.organization_id AND ur2.role = 'owner'
  )
),
earliest_user AS (
  SELECT DISTINCT ON (p.organization_id)
    ur.id AS role_id
  FROM public.profiles p
  INNER JOIN orgs_without_owner o ON o.organization_id = p.organization_id
  INNER JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.organization_id = p.organization_id AND ur.role = 'admin'
  ORDER BY p.organization_id, p.created_at ASC
)
UPDATE public.user_roles
SET role = 'owner'
WHERE id IN (SELECT role_id FROM earliest_user)
