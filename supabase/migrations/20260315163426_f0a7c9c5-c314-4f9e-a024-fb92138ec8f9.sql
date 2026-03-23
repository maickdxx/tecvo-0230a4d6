
-- Trigger to block time_clock_entries INSERT when the month is closed
CREATE OR REPLACE FUNCTION public.check_time_clock_month_closed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  entry_month integer;
  entry_year integer;
  is_closed boolean;
BEGIN
  entry_month := EXTRACT(MONTH FROM NEW.recorded_at);
  entry_year := EXTRACT(YEAR FROM NEW.recorded_at);

  SELECT EXISTS (
    SELECT 1 FROM public.time_clock_month_closures
    WHERE organization_id = NEW.organization_id
      AND user_id = NEW.user_id
      AND month = entry_month
      AND year = entry_year
      AND closed_at IS NOT NULL
      AND reopened_at IS NULL
  ) INTO is_closed;

  IF is_closed THEN
    RAISE EXCEPTION 'O período %/% está fechado. Não é possível registrar ponto.', entry_month, entry_year;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_month_closed_before_entry
  BEFORE INSERT ON public.time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.check_time_clock_month_closed();

-- Also block adjustments for closed periods
CREATE OR REPLACE FUNCTION public.check_time_clock_adjustment_month_closed()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  entry_recorded_at timestamptz;
  entry_month integer;
  entry_year integer;
  is_closed boolean;
BEGIN
  -- Get the entry's recorded_at to determine month
  SELECT recorded_at INTO entry_recorded_at
  FROM public.time_clock_entries
  WHERE id = NEW.entry_id;

  IF entry_recorded_at IS NULL THEN
    RETURN NEW;
  END IF;

  entry_month := EXTRACT(MONTH FROM entry_recorded_at);
  entry_year := EXTRACT(YEAR FROM entry_recorded_at);

  SELECT EXISTS (
    SELECT 1 FROM public.time_clock_month_closures
    WHERE organization_id = NEW.organization_id
      AND user_id = (SELECT user_id FROM public.time_clock_entries WHERE id = NEW.entry_id)
      AND month = entry_month
      AND year = entry_year
      AND closed_at IS NOT NULL
      AND reopened_at IS NULL
  ) INTO is_closed;

  IF is_closed THEN
    RAISE EXCEPTION 'O período %/% está fechado. Não é possível solicitar ajustes.', entry_month, entry_year;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_month_closed_before_adjustment
  BEFORE INSERT ON public.time_clock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.check_time_clock_adjustment_month_closed();
