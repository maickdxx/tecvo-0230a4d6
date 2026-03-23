
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;
