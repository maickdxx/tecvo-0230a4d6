
-- Create whatsapp_chat_history table for WhatsApp AI conversation context
CREATE TABLE public.whatsapp_chat_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for efficient queries (last 20 messages per phone per org)
CREATE INDEX idx_whatsapp_chat_history_lookup 
  ON public.whatsapp_chat_history (organization_id, phone_number, created_at DESC);

-- Enable RLS but NO public policies — only service_role can access
ALTER TABLE public.whatsapp_chat_history ENABLE ROW LEVEL SECURITY;
