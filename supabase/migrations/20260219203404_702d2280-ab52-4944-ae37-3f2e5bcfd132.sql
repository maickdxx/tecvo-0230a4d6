
-- Create whatsapp_labels table
CREATE TABLE public.whatsapp_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#10B981',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view labels in their org"
ON public.whatsapp_labels FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create labels in their org"
ON public.whatsapp_labels FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update labels in their org"
ON public.whatsapp_labels FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete labels in their org"
ON public.whatsapp_labels FOR DELETE
USING (organization_id = get_user_organization_id());

-- Create whatsapp_contact_labels table
CREATE TABLE public.whatsapp_contact_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.whatsapp_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, label_id)
);

ALTER TABLE public.whatsapp_contact_labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view contact labels in their org"
ON public.whatsapp_contact_labels FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create contact labels in their org"
ON public.whatsapp_contact_labels FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete contact labels in their org"
ON public.whatsapp_contact_labels FOR DELETE
USING (organization_id = get_user_organization_id());

-- Create whatsapp_automations table
CREATE TABLE public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'custom',
  trigger_config jsonb DEFAULT '{}',
  message_template text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view automations in their org"
ON public.whatsapp_automations FOR SELECT
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create automations in their org"
ON public.whatsapp_automations FOR INSERT
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update automations in their org"
ON public.whatsapp_automations FOR UPDATE
USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete automations in their org"
ON public.whatsapp_automations FOR DELETE
USING (organization_id = get_user_organization_id());
