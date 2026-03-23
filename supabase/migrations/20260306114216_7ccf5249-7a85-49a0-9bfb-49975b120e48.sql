UPDATE public.organizations
SET whatsapp_owner = phone
WHERE (whatsapp_owner IS NULL OR whatsapp_owner = '')
  AND phone IS NOT NULL
  AND phone != ''
  AND name != 'Tecvo';