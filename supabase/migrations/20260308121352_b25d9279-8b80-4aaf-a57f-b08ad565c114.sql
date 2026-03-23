
-- Add channel_type column to whatsapp_channels
ALTER TABLE public.whatsapp_channels 
ADD COLUMN IF NOT EXISTS channel_type text NOT NULL DEFAULT 'CUSTOMER_INBOX';

-- Update existing tecvo instance to TECVO_AI
UPDATE public.whatsapp_channels 
SET channel_type = 'TECVO_AI' 
WHERE instance_name = 'tecvo';
