-- Update the organization-logos bucket to be public
UPDATE storage.buckets SET public = true WHERE id = 'organization-logos';

-- Ensure RLS policies are set for public access if they don't exist
-- We want anyone to be able to see the logos
CREATE POLICY "Public Access for logos" ON storage.objects
FOR SELECT
USING (bucket_id = 'organization-logos');
