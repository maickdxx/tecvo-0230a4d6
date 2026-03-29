-- 1. Redefinir políticas de atualização da tabela profiles para restringir acesso aos campos de IA

-- Remover políticas existentes de UPDATE
DROP POLICY IF EXISTS "Admins can update profiles in their organization" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Criar política para Owners: Acesso total aos perfis da sua organização
CREATE POLICY "Owners can update profiles in their organization"
ON public.profiles
FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND has_role(auth.uid(), 'owner'::app_role)
)
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND has_role(auth.uid(), 'owner'::app_role)
);

-- Criar política para Admins: Podem editar campos de RH mas NÃO campos de IA
CREATE POLICY "Admins can update profiles in their organization"
ON public.profiles
FOR UPDATE
USING (
  organization_id = get_user_organization_id() 
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- Garantir que os campos de IA não foram alterados
  (SELECT ROW(p.whatsapp_ai_enabled, p.ai_assistant_name, p.ai_assistant_voice)
   FROM profiles p WHERE p.id = profiles.id)
  IS NOT DISTINCT FROM
  ROW(whatsapp_ai_enabled, ai_assistant_name, ai_assistant_voice)
);

-- Criar política para Usuários Comuns: Podem editar apenas seus próprios campos básicos
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    -- Garantir que campos protegidos (incluindo IA) não foram alterados
    (SELECT ROW(
      p.hourly_rate, p.cpf, p.rg, p.hire_date, p.employee_type, 
      p.address_cep, p.address_street, p.address_number, p.address_neighborhood, 
      p.address_city, p.address_state, p.notes, p."position", 
      p.field_worker, p.organization_id, p.user_id,
      p.whatsapp_ai_enabled, p.ai_assistant_name, p.ai_assistant_voice
     )
     FROM profiles p WHERE p.id = profiles.id)
    IS NOT DISTINCT FROM
    ROW(
      hourly_rate, cpf, rg, hire_date, employee_type, 
      address_cep, address_street, address_number, address_neighborhood, 
      address_city, address_state, notes, "position", 
      field_worker, organization_id, user_id,
      whatsapp_ai_enabled, ai_assistant_name, ai_assistant_voice
    )
  )
);
