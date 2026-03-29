ALTER TABLE campaign_config ADD COLUMN IF NOT EXISTS current_campaign_started_at timestamptz DEFAULT now();
UPDATE campaign_config SET current_campaign_started_at = now() WHERE id = 1;