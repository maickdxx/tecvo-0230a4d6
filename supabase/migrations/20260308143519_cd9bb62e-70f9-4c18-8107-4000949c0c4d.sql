
-- Transfer history table
CREATE TABLE public.whatsapp_transfer_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_user_id UUID,
  to_user_id UUID,
  action TEXT NOT NULL DEFAULT 'transfer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_transfer_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view transfer logs of their org"
  ON public.whatsapp_transfer_log
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can insert transfer logs of their org"
  ON public.whatsapp_transfer_log
  FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

-- Signature preference on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_signature_enabled BOOLEAN NOT NULL DEFAULT true;
