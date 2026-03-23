-- Create secure RPC to read a signature by exact token (for public signing page)
CREATE OR REPLACE FUNCTION public.get_signature_by_token(p_token uuid)
RETURNS TABLE(
  token uuid,
  signature_url text,
  service_id uuid,
  organization_id uuid,
  signed_at timestamptz,
  signer_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.token, s.signature_url, s.service_id, s.organization_id, s.signed_at, s.signer_name
  FROM public.service_signatures s
  WHERE s.token = p_token
    AND s.signature_url IS NULL
  LIMIT 1;
$$;

-- Create secure RPC to sign (update) a signature by exact token
CREATE OR REPLACE FUNCTION public.sign_service_signature(
  p_token uuid,
  p_signature_url text,
  p_signer_name text DEFAULT NULL,
  p_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_updated int;
BEGIN
  UPDATE public.service_signatures
  SET signature_url = p_signature_url,
      signer_name = p_signer_name,
      signed_at = now(),
      ip_address = p_ip_address
  WHERE token = p_token
    AND signature_url IS NULL;
  
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated > 0;
END;
$$;