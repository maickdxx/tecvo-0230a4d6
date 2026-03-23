
-- Quick Messages (Templates)
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  shortcut TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_quick_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quick messages in their org"
  ON public.whatsapp_quick_messages FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create quick messages in their org"
  ON public.whatsapp_quick_messages FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update quick messages in their org"
  ON public.whatsapp_quick_messages FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete quick messages in their org"
  ON public.whatsapp_quick_messages FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Add conversation status to whatsapp_contacts
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS conversation_status TEXT NOT NULL DEFAULT 'novo'
    CHECK (conversation_status IN ('novo', 'atendendo', 'aguardando', 'resolvido'));

-- Trigger for updated_at on quick messages
CREATE OR REPLACE FUNCTION public.update_whatsapp_quick_messages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_whatsapp_quick_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_whatsapp_quick_messages_updated_at();
