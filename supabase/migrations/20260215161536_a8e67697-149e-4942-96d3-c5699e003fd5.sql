ALTER TABLE public.organizations
ADD COLUMN cancel_at_period_end boolean NOT NULL DEFAULT false;