ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_organization_id_whatsapp_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_channel_whatsapp_id_unique
ON public.whatsapp_contacts (organization_id, channel_id, whatsapp_id)
WHERE whatsapp_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_channel_normalized_phone_unique
ON public.whatsapp_contacts (organization_id, channel_id, normalized_phone)
WHERE normalized_phone IS NOT NULL AND COALESCE(is_group, false) = false;