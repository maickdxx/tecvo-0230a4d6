
-- Add is_unread and last_message_at columns to whatsapp_contacts
ALTER TABLE public.whatsapp_contacts 
  ADD COLUMN IF NOT EXISTS is_unread boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_message_at timestamp with time zone DEFAULT NULL;

-- Index for faster sorting/filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_last_message_at 
  ON public.whatsapp_contacts(organization_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_conversation_status
  ON public.whatsapp_contacts(organization_id, conversation_status);

-- Backfill last_message_at from existing messages
UPDATE public.whatsapp_contacts c
SET last_message_at = (
  SELECT MAX(m.timestamp)
  FROM public.whatsapp_messages m
  WHERE m.contact_id = c.id
)
WHERE last_message_at IS NULL;
