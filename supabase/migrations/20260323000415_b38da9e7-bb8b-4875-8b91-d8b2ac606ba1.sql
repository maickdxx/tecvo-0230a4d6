
-- Add channel_status state machine column to whatsapp_channels
-- States: provisioning, qr_pending, connected, disconnected, reconnecting, deleting, deleted, error
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS channel_status TEXT NOT NULL DEFAULT 'disconnected';

-- Set existing channels to the correct state based on current is_connected
UPDATE public.whatsapp_channels SET channel_status = 'connected' WHERE is_connected = true;
UPDATE public.whatsapp_channels SET channel_status = 'disconnected' WHERE is_connected = false;

-- Add index for efficient lookups by org + phone + status
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_org_phone_status 
  ON public.whatsapp_channels (organization_id, phone_number, channel_status);
