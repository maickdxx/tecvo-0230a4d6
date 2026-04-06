-- Add pending action state to assistant_conversations (App channel)
ALTER TABLE public.assistant_conversations
  ADD COLUMN IF NOT EXISTS pending_action text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_service_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_client_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS awaiting_confirmation boolean DEFAULT false;

-- Add pending action state to whatsapp_contacts (WhatsApp channel)
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS pending_action text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_service_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pending_client_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS awaiting_confirmation boolean DEFAULT false;