-- Add logging columns to whatsapp_message_log for internal/platform messages
ALTER TABLE public.whatsapp_message_log 
ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
ADD COLUMN IF NOT EXISTS recipient_role TEXT;

-- Add comment to explain the shielding rule
COMMENT ON TABLE public.whatsapp_message_log IS 'Logs all WhatsApp send attempts. internal/platform messages are shielded to only reach the organization owner.';

-- Create an index for easier auditing of recipient roles
CREATE INDEX IF NOT EXISTS idx_whatsapp_message_log_recipient_role ON public.whatsapp_message_log(recipient_role);
