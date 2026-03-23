
CREATE OR REPLACE FUNCTION public.sync_conversion_status_from_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _contact_id uuid;
BEGIN
  -- Find whatsapp contact linked to this service
  SELECT id INTO _contact_id
  FROM public.whatsapp_contacts
  WHERE linked_service_id = NEW.id
  LIMIT 1;

  -- If no direct link, try via client_id (find most recent contact for this client in this org)
  IF _contact_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT id INTO _contact_id
    FROM public.whatsapp_contacts
    WHERE linked_client_id = NEW.client_id
      AND organization_id = NEW.organization_id
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF _contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Service created/scheduled → agendado (only upgrade, never downgrade from concluido)
  IF NEW.status IN ('scheduled', 'in_progress') THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'agendado'
    WHERE id = _contact_id
      AND conversion_status IN ('lead_novo', 'em_atendimento');
  END IF;

  -- Service completed → concluido
  IF NEW.status = 'completed' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'concluido'
    WHERE id = _contact_id
      AND conversion_status != 'concluido';
  END IF;

  -- Service cancelled → revert to em_atendimento only if was agendado
  IF NEW.status = 'cancelled' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'em_atendimento'
    WHERE id = _contact_id
      AND conversion_status = 'agendado';
  END IF;

  RETURN NEW;
END;
$function$;

-- Trigger on INSERT (new service created)
CREATE TRIGGER trg_sync_conversion_on_service_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_conversion_status_from_service();

-- Trigger on UPDATE (status changed)
CREATE TRIGGER trg_sync_conversion_on_service_update
  AFTER UPDATE OF status ON public.services
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_conversion_status_from_service();
