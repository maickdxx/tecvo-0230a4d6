
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

  -- If no direct link, try via client_id
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

  -- Use text cast to avoid enum comparison errors with non-existent values
  IF NEW.status::text = 'pending' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'em_atendimento'
    WHERE id = _contact_id
      AND conversion_status = 'novo_contato';
  END IF;

  IF NEW.status::text IN ('scheduled', 'in_progress') THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'agendado'
    WHERE id = _contact_id
      AND conversion_status IN ('novo_contato', 'em_atendimento');
  END IF;

  IF NEW.status::text = 'cancelled' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'em_atendimento'
    WHERE id = _contact_id
      AND conversion_status = 'agendado';
  END IF;

  RETURN NEW;
END;
$function$;
