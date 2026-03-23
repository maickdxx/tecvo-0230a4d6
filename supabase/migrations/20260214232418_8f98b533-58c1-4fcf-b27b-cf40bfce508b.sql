ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS auto_signature_os BOOLEAN DEFAULT false;