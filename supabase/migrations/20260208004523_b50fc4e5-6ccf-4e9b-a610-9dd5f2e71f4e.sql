-- Parte 2: Criar funções e políticas RLS

-- Criar função para verificar se usuário é employee
CREATE OR REPLACE FUNCTION public.is_employee(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'employee'
  )
$$;

-- Criar função para verificar se usuário NÃO é employee (pode editar)
CREATE OR REPLACE FUNCTION public.can_modify(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner', 'admin', 'member')
  )
$$;

-- Atualizar política SELECT de services para incluir employees
DROP POLICY IF EXISTS "Users can view services in their organization" ON services;

CREATE POLICY "Users can view services in their organization" ON services
  FOR SELECT USING (
    (organization_id = get_user_organization_id() AND can_modify(auth.uid()))
    OR
    (assigned_to = auth.uid() AND is_employee(auth.uid()))
  );

-- Atualizar política INSERT - employees não podem inserir
DROP POLICY IF EXISTS "Users can create services in their organization" ON services;

CREATE POLICY "Users can create services in their organization" ON services
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id() 
    AND can_modify(auth.uid())
  );

-- Atualizar política UPDATE - employees não podem atualizar
DROP POLICY IF EXISTS "Users can update services in their organization" ON services;

CREATE POLICY "Users can update services in their organization" ON services
  FOR UPDATE USING (
    organization_id = get_user_organization_id() 
    AND can_modify(auth.uid())
  );

-- Atualizar política DELETE - employees não podem deletar
DROP POLICY IF EXISTS "Users can delete services in their organization" ON services;

CREATE POLICY "Users can delete services in their organization" ON services
  FOR DELETE USING (
    organization_id = get_user_organization_id() 
    AND can_modify(auth.uid())
  );

-- Atualizar política de clients para employees
DROP POLICY IF EXISTS "Users can view clients in their organization" ON clients;

CREATE POLICY "Users can view clients in their organization" ON clients
  FOR SELECT USING (
    organization_id = get_user_organization_id()
    OR
    (is_employee(auth.uid()) AND id IN (
      SELECT client_id FROM services WHERE assigned_to = auth.uid()
    ))
  );

-- Atualizar política de profiles para ver funcionários da org
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;

CREATE POLICY "Users can view profiles in their organization" ON profiles
  FOR SELECT USING (
    organization_id = get_user_organization_id()
  );

-- Permitir admin/owner gerenciar roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

CREATE POLICY "Admins can manage user roles" ON user_roles
  FOR ALL USING (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')
  ) WITH CHECK (
    has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'admin')
  );