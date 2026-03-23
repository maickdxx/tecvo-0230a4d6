
-- Add require_client_signature to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS require_client_signature boolean DEFAULT false;

-- Create service_signatures table
CREATE TABLE public.service_signatures (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signature_url text,
  signer_name text,
  signed_at timestamptz,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_signatures ENABLE ROW LEVEL SECURITY;

-- Org members can view signatures
CREATE POLICY "Users can view signatures in their org"
ON public.service_signatures
FOR SELECT
USING (organization_id = get_user_organization_id());

-- Org members can create signatures
CREATE POLICY "Users can create signatures in their org"
ON public.service_signatures
FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

-- Org members can delete signatures
CREATE POLICY "Users can delete signatures in their org"
ON public.service_signatures
FOR DELETE
USING (organization_id = get_user_organization_id());

-- Org members can update signatures
CREATE POLICY "Users can update signatures in their org"
ON public.service_signatures
FOR UPDATE
USING (organization_id = get_user_organization_id());

-- Public: anyone with a valid token can read the signature record (to see OS info)
CREATE POLICY "Public can read signature by token"
ON public.service_signatures
FOR SELECT
USING (token IS NOT NULL AND signature_url IS NULL);

-- Public: anyone with a valid token can update (sign) if not yet signed
CREATE POLICY "Public can sign via token"
ON public.service_signatures
FOR UPDATE
USING (token IS NOT NULL AND signature_url IS NULL)
WITH CHECK (token IS NOT NULL);
