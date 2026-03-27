
-- Phase 1: Allow multiple contacts per org+phone when on different channels
-- This enables separate conversation threads per channel

-- Drop old unique indexes that enforce one contact per org+phone
DROP INDEX IF EXISTS idx_whatsapp_contacts_org_whatsapp_id_unique;
DROP INDEX IF EXISTS idx_whatsapp_contacts_org_normalized_phone_unique;

-- Create new unique indexes that include channel_id
CREATE UNIQUE INDEX idx_whatsapp_contacts_org_whatsapp_id_channel_unique 
  ON public.whatsapp_contacts (organization_id, whatsapp_id, channel_id) 
  WHERE (whatsapp_id IS NOT NULL);

CREATE UNIQUE INDEX idx_whatsapp_contacts_org_phone_channel_unique 
  ON public.whatsapp_contacts (organization_id, normalized_phone, channel_id) 
  WHERE (normalized_phone IS NOT NULL AND COALESCE(is_group, false) = false);

-- Add index for efficient channel-aware lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_channel 
  ON public.whatsapp_contacts (organization_id, channel_id);
