-- Criar tabela de convites
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'employee',
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invited_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Habilitar RLS
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Apenas owner/admin da org podem gerenciar convites
CREATE POLICY "Admins can view invites in their org"
  ON public.invites FOR SELECT
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can create invites in their org"
  ON public.invites FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Admins can delete invites in their org"
  ON public.invites FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- Política para permitir leitura anônima de convites por token (para validação no signup)
CREATE POLICY "Anyone can read invite by token"
  ON public.invites FOR SELECT
  TO anon, authenticated
  USING (accepted_at IS NULL);

-- Modificar função handle_new_user para verificar convites
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
BEGIN
  -- Verificar se existe convite válido para este email
  SELECT * INTO invite_record 
  FROM public.invites
  WHERE email = NEW.email 
    AND accepted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record.id IS NOT NULL THEN
    -- Usar organização do convite
    new_org_id := invite_record.organization_id;
    
    -- Marcar convite como aceito
    UPDATE public.invites 
    SET accepted_at = now() 
    WHERE id = invite_record.id;
    
    -- Criar perfil na organização existente
    INSERT INTO public.profiles (user_id, organization_id, full_name)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name');
    
    -- Atribuir role do convite
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, invite_record.role);
  ELSE
    -- Fluxo normal: criar nova organização
    INSERT INTO public.organizations (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    RETURNING id INTO new_org_id;
    
    INSERT INTO public.profiles (user_id, organization_id, full_name)
    VALUES (NEW.id, new_org_id, NEW.raw_user_meta_data->>'full_name');
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  END IF;
  
  RETURN NEW;
END;
$function$;