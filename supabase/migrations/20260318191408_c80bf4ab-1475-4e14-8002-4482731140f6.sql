-- Add organization_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Backfill organization_id from profiles
UPDATE public.user_roles ur
SET organization_id = p.organization_id
FROM public.profiles p
WHERE p.user_id = ur.user_id;

-- Make organization_id NOT NULL after backfill
ALTER TABLE public.user_roles ALTER COLUMN organization_id SET NOT NULL;

-- Drop old unique constraint and add new one scoped to org
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_org_key UNIQUE (user_id, role, organization_id);

-- Update has_role to scope by org (uses get_user_organization_id for current user context)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = _role
      AND organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- Update can_modify to scope by org
CREATE OR REPLACE FUNCTION public.can_modify(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role IN ('owner', 'admin', 'member')
      AND organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- Update is_employee to scope by org
CREATE OR REPLACE FUNCTION public.is_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
      AND role = 'employee'
      AND organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = _user_id LIMIT 1)
  )
$$;

-- Fix get_user_organization_id to be deterministic
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() ORDER BY created_at ASC LIMIT 1
$$;