
CREATE TABLE public.whatsapp_scheduled_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.whatsapp_channels(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  error_message TEXT
);

ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage scheduled messages in their org"
ON public.whatsapp_scheduled_messages
FOR ALL
TO authenticated
USING (organization_id = public.get_user_organization_id())
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE INDEX idx_scheduled_messages_contact ON public.whatsapp_scheduled_messages(contact_id, status);
CREATE INDEX idx_scheduled_messages_due ON public.whatsapp_scheduled_messages(status, scheduled_at) WHERE status = 'scheduled';
