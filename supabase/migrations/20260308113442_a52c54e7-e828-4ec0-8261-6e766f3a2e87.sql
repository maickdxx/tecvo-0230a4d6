
-- Just ensure normalized_phone column exists and is backfilled
-- (previous migration may have partially succeeded)
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

UPDATE public.whatsapp_contacts 
SET normalized_phone = regexp_replace(phone, '[^0-9]', '', 'g')
WHERE normalized_phone IS NULL AND phone IS NOT NULL;
