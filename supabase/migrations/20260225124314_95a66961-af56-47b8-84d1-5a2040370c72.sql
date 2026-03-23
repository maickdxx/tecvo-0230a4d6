
ALTER TABLE public.service_payments
  ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN confirmed_by uuid DEFAULT NULL,
  ADD COLUMN confirmed_at timestamptz DEFAULT NULL;
