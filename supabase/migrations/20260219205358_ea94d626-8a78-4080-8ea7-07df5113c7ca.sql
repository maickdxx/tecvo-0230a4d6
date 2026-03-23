
-- Create public bucket for WhatsApp media (audio files)
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on whatsapp-media bucket
CREATE POLICY "whatsapp_media_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- Allow service role to insert (edge functions use service role key)
CREATE POLICY "whatsapp_media_service_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'whatsapp-media');
