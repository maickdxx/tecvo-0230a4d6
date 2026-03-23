
-- Add columns for extended recurrence tracking (8, 10, 12 months)
ALTER TABLE public.recurrence_entries
  ADD COLUMN IF NOT EXISTS msg_8m_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS msg_10m_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS msg_12m_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_reason text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

-- Add extended message templates to config
ALTER TABLE public.recurrence_config
  ADD COLUMN IF NOT EXISTS message_8_months text,
  ADD COLUMN IF NOT EXISTS message_10_months text,
  ADD COLUMN IF NOT EXISTS message_12_months text;

-- Update the trigger to also mark previous entries as "reiniciado" when a new cycle starts
CREATE OR REPLACE FUNCTION public.auto_create_recurrence_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.service_type::text IN ('cleaning', 'installation')
     AND NEW.client_id IS NOT NULL
     AND NEW.completed_date IS NOT NULL
  THEN
    -- Close all previous active entries for this client as "reiniciado"
    UPDATE public.recurrence_entries
    SET is_active = false,
        closed_reason = 'reiniciado',
        closed_at = now(),
        stage = 'reiniciado',
        updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id
      AND is_active = true;

    -- Create new cycle
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

-- Recreate trigger with text cast for WHEN clause
DROP TRIGGER IF EXISTS trg_auto_recurrence_entry_insert ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.service_type::text IN ('cleaning', 'installation') AND NEW.client_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_create_recurrence_entry();
