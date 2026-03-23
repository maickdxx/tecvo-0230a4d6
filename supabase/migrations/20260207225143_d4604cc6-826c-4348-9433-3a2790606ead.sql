-- Add company profile fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN cnpj_cpf TEXT,
ADD COLUMN phone TEXT,
ADD COLUMN email TEXT,
ADD COLUMN address TEXT,
ADD COLUMN city TEXT,
ADD COLUMN state TEXT,
ADD COLUMN zip_code TEXT,
ADD COLUMN logo_url TEXT,
ADD COLUMN website TEXT;

-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('organization-logos', 'organization-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for uploading logos (users can upload to their org folder)
CREATE POLICY "Users can upload their organization logo"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'organization-logos' 
  AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid())
);

-- Create policy for updating logos
CREATE POLICY "Users can update their organization logo"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid())
);

-- Create policy for deleting logos
CREATE POLICY "Users can delete their organization logo"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'organization-logos'
  AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid())
);

-- Create policy for public read access to logos
CREATE POLICY "Organization logos are publicly accessible"
ON storage.objects
FOR SELECT
USING (bucket_id = 'organization-logos');