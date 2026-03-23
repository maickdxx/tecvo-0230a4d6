
-- Organization-level custom tags
CREATE TABLE public.whatsapp_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

ALTER TABLE public.whatsapp_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tags of their org"
  ON public.whatsapp_tags FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can insert tags of their org"
  ON public.whatsapp_tags FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can update tags of their org"
  ON public.whatsapp_tags FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Members can delete tags of their org"
  ON public.whatsapp_tags FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Seed default tags for existing organizations
INSERT INTO public.whatsapp_tags (organization_id, name, color)
SELECT o.id, t.name, t.color
FROM public.organizations o
CROSS JOIN (VALUES
  ('Orçamento', 'blue'),
  ('Cliente', 'emerald'),
  ('Suporte', 'amber'),
  ('Financeiro', 'purple'),
  ('Urgente', 'red')
) AS t(name, color)
ON CONFLICT DO NOTHING;
