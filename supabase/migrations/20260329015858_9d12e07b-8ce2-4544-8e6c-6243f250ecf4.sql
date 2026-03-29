
-- Helper function to normalize phone to digits with 55 prefix
CREATE OR REPLACE FUNCTION public.normalize_phone_digits(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN regexp_replace(COALESCE(raw, ''), '\D', '', 'g') = '' THEN NULL
    WHEN regexp_replace(raw, '\D', '', 'g') ~ '^55' THEN regexp_replace(raw, '\D', '', 'g')
    WHEN length(regexp_replace(raw, '\D', '', 'g')) <= 11 THEN '55' || regexp_replace(raw, '\D', '', 'g')
    ELSE regexp_replace(raw, '\D', '', 'g')
  END
$$;

-- Disable specific user triggers that cause circular updates
ALTER TABLE profiles DISABLE TRIGGER trg_sync_whatsapp_personal_to_org;
ALTER TABLE organizations DISABLE TRIGGER trg_check_whatsapp_owner_permission;
ALTER TABLE organizations DISABLE TRIGGER on_whatsapp_owner_set;

-- Step 1: Backfill whatsapp_personal from whatsapp_owner for owners who lack it
UPDATE profiles
SET whatsapp_personal = public.normalize_phone_digits(o.whatsapp_owner)
FROM organizations o, user_roles ur
WHERE profiles.organization_id = o.id
  AND ur.organization_id = o.id 
  AND ur.user_id = profiles.user_id 
  AND ur.role = 'owner'
  AND (profiles.whatsapp_personal IS NULL OR profiles.whatsapp_personal = '')
  AND o.whatsapp_owner IS NOT NULL AND o.whatsapp_owner != '';

-- Step 2: Normalize existing whatsapp_personal values (remove formatting)
UPDATE profiles
SET whatsapp_personal = public.normalize_phone_digits(whatsapp_personal)
WHERE whatsapp_personal IS NOT NULL AND whatsapp_personal != ''
  AND whatsapp_personal ~ '\D';

-- Step 3: Normalize existing phone values
UPDATE profiles
SET phone = public.normalize_phone_digits(phone)
WHERE phone IS NOT NULL AND phone != ''
  AND phone ~ '\D';

-- Step 4: Backfill phone from whatsapp_personal where phone is empty
UPDATE profiles
SET phone = whatsapp_personal
WHERE (phone IS NULL OR phone = '')
  AND whatsapp_personal IS NOT NULL AND whatsapp_personal != '';

-- Step 5: Normalize organizations.phone
UPDATE organizations
SET phone = public.normalize_phone_digits(phone)
WHERE phone IS NOT NULL AND phone != ''
  AND phone ~ '\D';

-- Step 6: Normalize organizations.whatsapp_owner
UPDATE organizations
SET whatsapp_owner = public.normalize_phone_digits(whatsapp_owner)
WHERE whatsapp_owner IS NOT NULL AND whatsapp_owner != ''
  AND whatsapp_owner ~ '\D';

-- Re-enable triggers
ALTER TABLE profiles ENABLE TRIGGER trg_sync_whatsapp_personal_to_org;
ALTER TABLE organizations ENABLE TRIGGER trg_check_whatsapp_owner_permission;
ALTER TABLE organizations ENABLE TRIGGER on_whatsapp_owner_set;

-- Step 7: Update sync trigger — only populate org.whatsapp_owner if it's empty (initial setup)
CREATE OR REPLACE FUNCTION public.sync_whatsapp_personal_to_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.whatsapp_personal IS DISTINCT FROM OLD.whatsapp_personal
     AND NEW.whatsapp_personal IS NOT NULL AND NEW.whatsapp_personal != ''
  THEN
    UPDATE public.organizations
    SET whatsapp_owner = NEW.whatsapp_personal
    WHERE id = NEW.organization_id
      AND (whatsapp_owner IS NULL OR whatsapp_owner = '');
  END IF;
  RETURN NEW;
END;
$$;

-- Step 8: Update handle_new_user to always populate whatsapp_personal on profiles
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
  v_normalized_phone TEXT;
BEGIN
  v_phone := NEW.raw_user_meta_data->>'phone';
  
  -- Normalize phone to digits with country code
  IF v_phone IS NOT NULL AND v_phone != '' THEN
    v_normalized_phone := public.normalize_phone_digits(v_phone);
  END IF;

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
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name',
      v_normalized_phone,
      v_normalized_phone,
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
      v_normalized_phone
    )
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.profiles (
      user_id, organization_id, full_name, phone, whatsapp_personal,
      first_utm_source, first_utm_medium, first_utm_campaign,
      first_referrer, first_landing_page
    )
    VALUES (
      NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name',
      v_normalized_phone,
      v_normalized_phone,
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
$$;
