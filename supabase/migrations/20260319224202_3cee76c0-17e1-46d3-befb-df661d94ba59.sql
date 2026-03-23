
CREATE OR REPLACE FUNCTION public.auto_create_recurrence_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.service_type IN ('cleaning', 'installation')
     AND NEW.client_id IS NOT NULL
     AND NEW.completed_date IS NOT NULL
  THEN
    UPDATE public.recurrence_entries
    SET is_active = false, updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id
      AND is_active = true;

    INSERT INTO public.recurrence_entries (
      organization_id, client_id, source_service_id, source_service_type,
      source_completed_date, source_value, stage, next_action_date
    ) VALUES (
      NEW.organization_id, NEW.client_id, NEW.id, NEW.service_type::text,
      NEW.completed_date, NEW.value, 'aguardando',
      (NEW.completed_date + interval '2 months')::date
    )
    ON CONFLICT (organization_id, client_id, source_service_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recurrence_entry ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_recurrence_entry();

DROP TRIGGER IF EXISTS trg_auto_recurrence_entry_insert ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.service_type IN ('cleaning', 'installation') AND NEW.client_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_create_recurrence_entry();
