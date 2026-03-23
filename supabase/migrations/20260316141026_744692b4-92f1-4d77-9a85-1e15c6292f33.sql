
-- Prevent duplicate clock_in entries for the same user on the same calendar day
CREATE OR REPLACE FUNCTION public.prevent_duplicate_clock_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.entry_type = 'clock_in' THEN
    IF EXISTS (
      SELECT 1 FROM public.time_clock_entries
      WHERE user_id = NEW.user_id
        AND entry_type = 'clock_in'
        AND recorded_at::date = NEW.recorded_at::date
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Já existe um registro de entrada para este dia. Solicite ajuste se necessário.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_duplicate_clock_in
  BEFORE INSERT ON public.time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_clock_in();
