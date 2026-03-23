CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_channel_org_phone 
ON public.whatsapp_channels (organization_id, phone_number, channel_type)
WHERE channel_status != 'deleted' AND phone_number IS NOT NULL;