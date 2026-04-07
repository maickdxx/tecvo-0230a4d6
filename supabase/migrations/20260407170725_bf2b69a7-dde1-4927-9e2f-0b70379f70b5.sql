
-- 1. Add is_system flag to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Create the system admin organization with a fixed UUID
INSERT INTO public.organizations (id, name, plan, is_system)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tecvo System Admin',
  'pro',
  true
)
ON CONFLICT (id) DO UPDATE SET is_system = true, name = 'Tecvo System Admin', plan = 'pro';

-- 3. Recreate the TECVO_AI channel for instance "tecvo"
INSERT INTO public.whatsapp_channels (
  id, organization_id, instance_name, channel_type, channel_status, is_connected, name
)
VALUES (
  'bd62f82a-ddfc-4bde-b4b5-c73f1e1a9b32',
  '00000000-0000-0000-0000-000000000001',
  'tecvo',
  'TECVO_AI',
  'connected',
  true,
  'Laura IA - Canal Institucional'
)
ON CONFLICT (id) DO UPDATE SET
  organization_id = '00000000-0000-0000-0000-000000000001',
  instance_name = 'tecvo',
  channel_type = 'TECVO_AI',
  channel_status = 'connected',
  is_connected = true,
  name = 'Laura IA - Canal Institucional';

-- 4. Protection: prevent deletion of system organizations
CREATE OR REPLACE FUNCTION public.guard_system_org_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'Não é permitido excluir a organização administrativa do sistema.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_system_org_deletion ON public.organizations;
CREATE TRIGGER prevent_system_org_deletion
  BEFORE DELETE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_system_org_deletion();

-- 5. Protection: prevent deletion of TECVO_AI channels
CREATE OR REPLACE FUNCTION public.guard_system_channel_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.channel_type = 'TECVO_AI' THEN
    RAISE EXCEPTION 'Não é permitido excluir o canal institucional da IA.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prevent_system_channel_deletion ON public.whatsapp_channels;
CREATE TRIGGER prevent_system_channel_deletion
  BEFORE DELETE ON public.whatsapp_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_system_channel_deletion();
