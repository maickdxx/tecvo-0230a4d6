ALTER TABLE public.time_clock_settings
  ADD COLUMN IF NOT EXISTS overtime_rate_weekday integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS overtime_rate_weekend integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS consider_saturday_weekend boolean NOT NULL DEFAULT true;