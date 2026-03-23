
-- 1. Criar tabela super_admin_grants
CREATE TABLE public.super_admin_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  is_root boolean NOT NULL DEFAULT false
);

ALTER TABLE public.super_admin_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can read grants"
  ON public.super_admin_grants FOR SELECT
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert grants"
  ON public.super_admin_grants FOR INSERT
  TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can delete non-root grants"
  ON public.super_admin_grants FOR DELETE
  TO authenticated
  USING (public.is_super_admin(auth.uid()) AND is_root = false);

-- 2. Inserir registro raiz
INSERT INTO public.super_admin_grants (user_id, granted_by, is_root)
VALUES ('c68e3697-c547-4dc5-93cf-b5d46b770ed1', NULL, true);

-- 3. Criar funcao is_root_super_admin
CREATE OR REPLACE FUNCTION public.is_root_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.super_admin_grants
    WHERE user_id = _user_id AND is_root = true
  )
$$;

-- 4. Atualizar RLS da user_roles para super_admin
-- Adicionar policy para super_admin inserir role super_admin
CREATE POLICY "Super admin can grant super_admin role"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    AND role = 'super_admin'
  );

-- Adicionar policy para super_admin remover role super_admin (exceto raiz)
CREATE POLICY "Super admin can revoke super_admin role"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    AND role = 'super_admin'
    AND NOT public.is_root_super_admin(user_id)
  );

-- 5. Criar funcao get_all_platform_users
CREATE OR REPLACE FUNCTION public.get_all_platform_users()
RETURNS TABLE (
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
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only super_admin can execute
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
    au.last_sign_in_at
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.user_id = au.id
  LEFT JOIN public.organizations o ON o.id = p.organization_id
  ORDER BY au.created_at DESC;
END;
$$;
