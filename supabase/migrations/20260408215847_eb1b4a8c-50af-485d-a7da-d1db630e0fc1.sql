ALTER TABLE public.pending_choices ALTER COLUMN contact_id DROP NOT NULL;
ALTER TABLE public.pending_choices ADD COLUMN IF NOT EXISTS conversation_id text DEFAULT NULL;