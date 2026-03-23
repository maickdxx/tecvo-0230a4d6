-- Add instance_name and owner_jid columns to whatsapp_channels for robust tracking
ALTER TABLE public.whatsapp_channels
  ADD COLUMN IF NOT EXISTS instance_name text,
  ADD COLUMN IF NOT EXISTS owner_jid text,
  ADD COLUMN IF NOT EXISTS disconnected_reason text;

-- Backfill instance_name for existing channels using the known naming convention
UPDATE public.whatsapp_channels
SET instance_name = 'org_' || replace(id::text, '-', '_')
WHERE instance_name IS NULL;

COMMENT ON COLUMN public.whatsapp_channels.instance_name IS 'Evolution API instance name, e.g. org_uuid_with_underscores';
COMMENT ON COLUMN public.whatsapp_channels.owner_jid IS 'Owner JID returned by Evolution API after connection, e.g. 5511999999999@s.whatsapp.net';
COMMENT ON COLUMN public.whatsapp_channels.disconnected_reason IS 'Last disconnection reason from Evolution API';