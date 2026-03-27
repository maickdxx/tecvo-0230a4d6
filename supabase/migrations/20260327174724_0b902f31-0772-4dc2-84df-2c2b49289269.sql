-- 1. Standardize columns in profiles
DO $$
BEGIN
    -- Rename columns if they exist with 'initial_' prefix to 'first_' prefix if needed,
    -- but we already have both. Let's just drop 'initial_' and keep 'first_'.
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'initial_utm_source') THEN
        ALTER TABLE public.profiles DROP COLUMN initial_utm_source;
        ALTER TABLE public.profiles DROP COLUMN initial_utm_medium;
        ALTER TABLE public.profiles DROP COLUMN initial_utm_campaign;
        ALTER TABLE public.profiles DROP COLUMN initial_referrer;
        ALTER TABLE public.profiles DROP COLUMN initial_landing_page;
    END IF;

    -- Ensure 'first_' columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_utm_source') THEN
        ALTER TABLE public.profiles ADD COLUMN first_utm_source TEXT;
        ALTER TABLE public.profiles ADD COLUMN first_utm_medium TEXT;
        ALTER TABLE public.profiles ADD COLUMN first_utm_campaign TEXT;
        ALTER TABLE public.profiles ADD COLUMN first_referrer TEXT;
        ALTER TABLE public.profiles ADD COLUMN first_landing_page TEXT;
    END IF;
END $$;

-- 2. Update handle_new_user trigger to capture UTMs from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
BEGIN
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
      user_id, 
      organization_id, 
      full_name, 
      phone,
      first_utm_source,
      first_utm_medium,
      first_utm_campaign,
      first_referrer,
      first_landing_page
    )
    VALUES (
      NEW.id, 
      new_org_id, 
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'phone',
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
    
    INSERT INTO public.profiles (
      user_id, 
      organization_id, 
      full_name, 
      phone,
      first_utm_source,
      first_utm_medium,
      first_utm_campaign,
      first_referrer,
      first_landing_page
    )
    VALUES (
      NEW.id, 
      new_org_id, 
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'phone',
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