
-- Create dedicated bucket for service signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-signatures', 'service-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload signatures
CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'service-signatures');

-- Allow public read access to signatures
CREATE POLICY "Public read access for signatures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'service-signatures');

-- Allow anon users to upload signatures (for public signing via token)
CREATE POLICY "Anon users can upload signatures via token"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'service-signatures');

-- Add signer_name column to service_signatures if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'service_signatures' AND column_name = 'signer_name'
  ) THEN
    ALTER TABLE public.service_signatures ADD COLUMN signer_name text;
  END IF;
END $$;
