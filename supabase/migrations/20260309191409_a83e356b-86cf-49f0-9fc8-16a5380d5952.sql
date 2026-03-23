
-- Add has_conversation flag to separate "contacts" from "conversations"
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS has_conversation boolean NOT NULL DEFAULT false;

-- Set has_conversation = true for all contacts that already have messages
UPDATE public.whatsapp_contacts wc
SET has_conversation = true
WHERE EXISTS (
  SELECT 1 FROM public.whatsapp_messages wm WHERE wm.contact_id = wc.id LIMIT 1
);

-- Also set has_conversation = true for contacts with last_message_at (safety net)
UPDATE public.whatsapp_contacts
SET has_conversation = true
WHERE last_message_at IS NOT NULL AND has_conversation = false;

-- Create trigger to auto-set has_conversation when a message is inserted
CREATE OR REPLACE FUNCTION public.set_contact_has_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.whatsapp_contacts
  SET has_conversation = true
  WHERE id = NEW.contact_id AND has_conversation = false;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_contact_has_conversation
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_contact_has_conversation();
