
-- Add last_access column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_access timestamptz;

-- Drop old function signature and recreate with last_access
DROP FUNCTION IF EXISTS public.get_all_platform_users();

CREATE OR REPLACE FUNCTION public.get_all_platform_users()
RETURNS TABLE(
  user_id uuid,
  email text,
  full_name text,
  phone text,
  organization_id uuid,
  organization_name text,
  plan text,
  plan_expires_at timestamptz,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  org_cnpj_cpf text,
  org_city text,
  org_state text,
  roles text[],
  created_at timestamptz,
  last_access timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied: requires super_admin role';
  END IF;

  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.email::text,
    p.full_name::text,
    p.phone::text,
    o.id AS organization_id,
    o.name::text AS organization_name,
    o.plan::text,
    o.plan_expires_at::timestamptz,
    o.trial_started_at::timestamptz,
    o.trial_ends_at::timestamptz,
    o.cnpj_cpf::text AS org_cnpj_cpf,
    o.city::text AS org_city,
    o.state::text AS org_state,
    COALESCE(
      (SELECT array_agg(ur.role::text) FROM public.user_roles ur WHERE ur.user_id = au.id),
      ARRAY[]::text[]
    ) AS roles,
    au.created_at,
    p.last_access
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  ORDER BY au.created_at DESC;
END;
$$;
