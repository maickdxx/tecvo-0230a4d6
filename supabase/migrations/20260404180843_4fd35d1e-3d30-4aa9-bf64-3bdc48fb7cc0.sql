
CREATE TABLE public.service_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  quote_number TEXT,
  service_description TEXT,
  service_value NUMERIC NOT NULL DEFAULT 0,
  payments_snapshot JSONB DEFAULT '[]'::jsonb,
  message TEXT NOT NULL,
  sent_via TEXT DEFAULT 'whatsapp',
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org receipts"
  ON public.service_receipts FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can create org receipts"
  ON public.service_receipts FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can update org receipts"
  ON public.service_receipts FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

CREATE INDEX idx_service_receipts_org ON public.service_receipts(organization_id);
CREATE INDEX idx_service_receipts_service ON public.service_receipts(service_id);

CREATE TRIGGER update_service_receipts_updated_at
  BEFORE UPDATE ON public.service_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
