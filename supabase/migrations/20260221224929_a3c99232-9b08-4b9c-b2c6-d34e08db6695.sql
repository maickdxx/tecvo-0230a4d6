
-- Add Cloud API columns to whatsapp_channels
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS phone_number_id text,
  ADD COLUMN IF NOT EXISTS access_token text,
  ADD COLUMN IF NOT EXISTS integration_type text NOT NULL DEFAULT 'cloud_api';

-- Set existing channels to 'evolution' type
UPDATE public.whatsapp_channels SET integration_type = 'evolution' WHERE integration_type = 'cloud_api';

-- Index for webhook lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_phone_number_id ON public.whatsapp_channels(phone_number_id) WHERE phone_number_id IS NOT NULL;
