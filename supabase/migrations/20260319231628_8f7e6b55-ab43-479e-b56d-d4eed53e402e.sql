-- Fix UPDATE trigger to only fire on relevant status changes (not every update)
DROP TRIGGER IF EXISTS trg_auto_recurrence_entry ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry
  AFTER UPDATE ON public.services
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.client_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_create_recurrence_entry();

-- Add index for recurrence queries performance
CREATE INDEX IF NOT EXISTS idx_recurrence_entries_org_active 
  ON public.recurrence_entries (organization_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_recurrence_entries_next_action 
  ON public.recurrence_entries (next_action_date) 
  WHERE is_active = true;