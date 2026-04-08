
-- Function to sync service status to WhatsApp contact pipeline
CREATE OR REPLACE FUNCTION public.sync_service_to_whatsapp_pipeline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_contact_id uuid;
  v_new_conversion_status text;
  v_has_active_services boolean;
  v_service_status text;
  v_operational_status text;
  v_scheduled_date timestamptz;
BEGIN
  -- Determine which record to use
  IF TG_OP = 'DELETE' THEN
    v_service_status := OLD.status::text;
    v_operational_status := OLD.operational_status;
    v_scheduled_date := OLD.scheduled_date;
  ELSE
    v_service_status := NEW.status::text;
    v_operational_status := NEW.operational_status;
    v_scheduled_date := NEW.scheduled_date;
  END IF;

  -- Find the WhatsApp contact linked to this client
  SELECT wc.id INTO v_contact_id
  FROM public.whatsapp_contacts wc
  WHERE wc.linked_client_id = COALESCE(NEW.client_id, OLD.client_id)
    AND wc.organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
    AND wc.is_blocked = false
  ORDER BY wc.last_message_at DESC NULLS LAST
  LIMIT 1;

  -- No linked WhatsApp contact found, skip
  IF v_contact_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Determine the new conversion_status based on service state
  IF TG_OP = 'DELETE' OR (v_service_status = 'cancelled' AND (OLD IS NULL OR OLD.status::text != 'cancelled')) THEN
    -- Service deleted or cancelled: check if there are other active services
    SELECT EXISTS(
      SELECT 1 FROM public.services s
      WHERE s.client_id = COALESCE(NEW.client_id, OLD.client_id)
        AND s.organization_id = COALESCE(NEW.organization_id, OLD.organization_id)
        AND s.deleted_at IS NULL
        AND s.status::text != 'cancelled'
        AND s.id != COALESCE(OLD.id, NEW.id)
    ) INTO v_has_active_services;

    IF NOT v_has_active_services THEN
      v_new_conversion_status := 'qualificacao';
    ELSE
      -- There are other active services, don't change
      RETURN COALESCE(NEW, OLD);
    END IF;
  ELSIF v_service_status = 'completed' AND (OLD IS NULL OR OLD.status::text != 'completed') THEN
    -- Service completed
    -- Check if there are other non-completed active services
    SELECT EXISTS(
      SELECT 1 FROM public.services s
      WHERE s.client_id = NEW.client_id
        AND s.organization_id = NEW.organization_id
        AND s.deleted_at IS NULL
        AND s.status::text NOT IN ('cancelled', 'completed')
        AND s.id != NEW.id
    ) INTO v_has_active_services;

    IF v_has_active_services THEN
      RETURN NEW;
    END IF;
    v_new_conversion_status := 'pos_atendimento';
  ELSIF v_operational_status = 'in_attendance' AND (OLD IS NULL OR OLD.operational_status IS DISTINCT FROM 'in_attendance') THEN
    v_new_conversion_status := 'em_execucao';
  ELSIF v_operational_status = 'en_route' AND (OLD IS NULL OR OLD.operational_status IS DISTINCT FROM 'en_route') THEN
    v_new_conversion_status := 'em_execucao';
  ELSIF v_service_status = 'scheduled' AND v_scheduled_date IS NOT NULL THEN
    -- Only move to agendado if currently in an earlier stage
    v_new_conversion_status := 'agendado';
  ELSIF v_service_status = 'in_progress' AND (OLD IS NULL OR OLD.status::text != 'in_progress') THEN
    v_new_conversion_status := 'em_execucao';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Update the WhatsApp contact pipeline
  UPDATE public.whatsapp_contacts
  SET conversion_status = v_new_conversion_status,
      conversation_status = CASE 
        WHEN conversation_status = 'resolvido' THEN 'atendendo'
        ELSE conversation_status
      END
  WHERE id = v_contact_id
    -- Only advance pipeline, never go backwards (except on delete/cancel)
    AND (
      (TG_OP = 'DELETE' OR v_service_status = 'cancelled')
      OR conversion_status IN ('novo_contato', 'qualificacao', 'orcamento', 'aguardando_cliente', 'aguardando_aprovacao', 'aguardando_pagamento')
      OR (v_new_conversion_status = 'em_execucao' AND conversion_status = 'agendado')
      OR (v_new_conversion_status = 'pos_atendimento' AND conversion_status IN ('agendado', 'em_execucao'))
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on services table for INSERT and UPDATE
CREATE TRIGGER sync_whatsapp_pipeline_on_service_change
AFTER INSERT OR UPDATE OF status, operational_status, scheduled_date, client_id
ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_to_whatsapp_pipeline();

-- Create trigger for DELETE
CREATE TRIGGER sync_whatsapp_pipeline_on_service_delete
AFTER DELETE
ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_to_whatsapp_pipeline();
