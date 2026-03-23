-- Create table for WhatsApp sessions (stores Baileys credentials)
CREATE TABLE public.whatsapp_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL DEFAULT '{}',
  phone_number TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Create table for WhatsApp contacts cache
CREATE TABLE public.whatsapp_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  whatsapp_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  profile_picture_url TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, whatsapp_id)
);

-- Create table for WhatsApp messages
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type TEXT,
  is_from_me BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, message_id)
);

-- Enable RLS on all tables
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_sessions
CREATE POLICY "Users can view their org session"
  ON public.whatsapp_sessions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create their org session"
  ON public.whatsapp_sessions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their org session"
  ON public.whatsapp_sessions FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete their org session"
  ON public.whatsapp_sessions FOR DELETE
  USING (organization_id = get_user_organization_id());

-- RLS policies for whatsapp_contacts
CREATE POLICY "Users can view their org contacts"
  ON public.whatsapp_contacts FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create contacts in their org"
  ON public.whatsapp_contacts FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update contacts in their org"
  ON public.whatsapp_contacts FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete contacts in their org"
  ON public.whatsapp_contacts FOR DELETE
  USING (organization_id = get_user_organization_id());

-- RLS policies for whatsapp_messages
CREATE POLICY "Users can view their org messages"
  ON public.whatsapp_messages FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create messages in their org"
  ON public.whatsapp_messages FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update messages in their org"
  ON public.whatsapp_messages FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete messages in their org"
  ON public.whatsapp_messages FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;

-- Create trigger for updated_at using existing function
CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_whatsapp_contacts_updated_at
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();