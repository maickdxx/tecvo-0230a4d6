
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
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role);
  ELSE
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name, phone)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$$;
