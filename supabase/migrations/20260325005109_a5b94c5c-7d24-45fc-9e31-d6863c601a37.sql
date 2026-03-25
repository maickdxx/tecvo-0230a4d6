
DROP FUNCTION IF EXISTS public.sign_service_signature(uuid, text, text, text);

CREATE FUNCTION public.sign_service_signature(
  p_token uuid,
  p_signature_url text,
  p_signer_name text,
  p_ip_address text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  _existing_url text;
BEGIN
  SELECT signature_url INTO _existing_url
  FROM public.service_signatures
  WHERE token = p_token;
  
  IF _existing_url IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.service_signatures
  SET signature_url = p_signature_url,
      signer_name = p_signer_name,
      signed_at = now(),
      ip_address = p_ip_address
  WHERE token = p_token
    AND signature_url IS NULL;

  RETURN FOUND;
END;
$$;
