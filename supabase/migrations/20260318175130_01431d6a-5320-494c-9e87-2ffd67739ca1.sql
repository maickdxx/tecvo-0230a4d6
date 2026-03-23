
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS maintenance_reminder_enabled boolean NOT NULL DEFAULT false;
