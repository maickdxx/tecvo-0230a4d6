
ALTER TABLE public.whatsapp_bot_connections
  ALTER COLUMN from_step_id DROP NOT NULL;

ALTER TABLE public.whatsapp_bot_connections
  DROP CONSTRAINT IF EXISTS whatsapp_bot_connections_from_step_id_fkey;

ALTER TABLE public.whatsapp_bot_connections
  ADD CONSTRAINT whatsapp_bot_connections_from_step_id_fkey
  FOREIGN KEY (from_step_id) REFERENCES public.whatsapp_bot_steps(id) ON DELETE CASCADE;
