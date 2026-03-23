-- Add tags array and last_message_content to whatsapp_contacts
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS last_message_content text;

-- Create index for tags filtering
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_tags ON public.whatsapp_contacts USING GIN(tags);
