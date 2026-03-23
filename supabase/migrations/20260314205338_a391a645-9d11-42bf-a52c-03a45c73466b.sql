ALTER TABLE public.whatsapp_messages
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reply_to_message_id text,
ADD COLUMN IF NOT EXISTS reply_to_content text,
ADD COLUMN IF NOT EXISTS reply_to_sender text;