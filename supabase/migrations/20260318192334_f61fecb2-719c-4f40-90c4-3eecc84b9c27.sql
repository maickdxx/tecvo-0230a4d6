
-- Add audit trigger for time_clock_entries INSERT events
-- This ensures all clock registrations are captured in the audit log
CREATE TRIGGER trg_audit_time_clock_entries
  AFTER INSERT ON public.time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_time_clock_change();
