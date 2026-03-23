-- 1. Criar função para verificar se usuário pertence à mesma organização
CREATE OR REPLACE FUNCTION public.is_same_organization(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.organization_id = p2.organization_id
    WHERE p1.user_id = auth.uid()
      AND p2.user_id = _user_id
  )
$$;

-- 2. Remover política antiga de SELECT em user_roles
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- 3. Criar nova política que permite admins/owners verem roles da mesma organização
CREATE POLICY "Users can view roles in their organization"
ON user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR is_super_admin(auth.uid())
  OR (
    (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin'))
    AND is_same_organization(user_id)
  )
);