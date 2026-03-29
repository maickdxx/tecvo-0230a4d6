ALTER TABLE public.campaign_sends 
  ADD COLUMN IF NOT EXISTS primary_channel text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS channel_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz;