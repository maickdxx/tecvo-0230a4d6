-- Re-add whatsapp_personal for backward compatibility with legacy edge functions and triggers
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_personal text;

-- Backfill data from phone column
UPDATE public.profiles SET whatsapp_personal = phone WHERE whatsapp_personal IS NULL;

-- Create or update trigger to keep whatsapp_personal in sync with phone
CREATE OR REPLACE FUNCTION public.sync_phone_to_whatsapp_personal()
RETURNS trigger AS $$
BEGIN
  NEW.whatsapp_personal := NEW.phone;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_phone_to_whatsapp_personal ON public.profiles;
CREATE TRIGGER trg_sync_phone_to_whatsapp_personal
  BEFORE INSERT OR UPDATE OF phone ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_phone_to_whatsapp_personal();

-- Ensure profiles_safe view also includes it if any legacy code uses it
DROP VIEW IF EXISTS public.profiles_safe;
CREATE OR REPLACE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  *
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;