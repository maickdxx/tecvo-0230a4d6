
CREATE TABLE public.service_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  brand TEXT DEFAULT '',
  model TEXT DEFAULT '',
  serial_number TEXT DEFAULT '',
  conditions TEXT DEFAULT '',
  defects TEXT DEFAULT '',
  solution TEXT DEFAULT '',
  technical_report TEXT DEFAULT '',
  warranty_terms TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.service_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view equipment of their organization"
  ON public.service_equipment FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert equipment for their organization"
  ON public.service_equipment FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update equipment of their organization"
  ON public.service_equipment FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete equipment of their organization"
  ON public.service_equipment FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());
