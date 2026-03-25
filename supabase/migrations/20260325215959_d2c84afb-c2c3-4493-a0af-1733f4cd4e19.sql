-- 1. Rename 'lead_novo' to 'novo_contato' and update default
ALTER TABLE public.whatsapp_contacts ALTER COLUMN conversion_status SET DEFAULT 'novo_contato';

-- 2. Update existing data
UPDATE public.whatsapp_contacts SET conversion_status = 'novo_contato' WHERE conversion_status = 'lead_novo' OR conversion_status = 'pending';

-- 3. Update the trigger function to match requirements
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

  -- Requirement 3: Creation of OS (even if pending/open)
  -- If service is new (INSERT) or status changed to pending/open
  IF NEW.status = 'pending' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'em_atendimento'
    WHERE id = _contact_id
      AND conversion_status = 'novo_contato';
  END IF;

  -- Requirement 4: Scheduling (scheduled/in_progress)
  IF NEW.status IN ('scheduled', 'in_progress') THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'agendado'
    WHERE id = _contact_id
      AND conversion_status IN ('novo_contato', 'em_atendimento');
  END IF;

  -- Requirement 5: OS Finalization (DO NOT change to concluido)
  -- The previous block for NEW.status = 'completed' is REMOVED to prevent automatic conclusion.

  -- Handle cancellation
  IF NEW.status = 'cancelled' THEN
    UPDATE public.whatsapp_contacts
    SET conversion_status = 'em_atendimento'
    WHERE id = _contact_id
      AND conversion_status = 'agendado';
  END IF;

  RETURN NEW;
END;
$function$;
