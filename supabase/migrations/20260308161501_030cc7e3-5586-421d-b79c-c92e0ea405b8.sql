
-- Webchat configuration table
CREATE TABLE public.webchat_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  position text NOT NULL DEFAULT 'right',
  color text NOT NULL DEFAULT '#2563eb',
  button_text text DEFAULT 'Fale conosco',
  welcome_message text DEFAULT 'Olá! Como podemos ajudar?',
  auto_show_welcome boolean NOT NULL DEFAULT false,
  display_name text DEFAULT 'Atendimento',
  avatar_url text,
  bottom_distance integer NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.webchat_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org webchat config"
  ON public.webchat_configs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create webchat config in their org"
  ON public.webchat_configs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update their org webchat config"
  ON public.webchat_configs FOR UPDATE
  USING (organization_id = get_user_organization_id());

-- Allow anonymous read for widget to fetch config
CREATE POLICY "Public can read active webchat configs by org id"
  ON public.webchat_configs FOR SELECT
  TO anon
  USING (is_active = true);

-- Add source column to whatsapp_contacts to distinguish channel source
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS source text DEFAULT 'whatsapp';

-- Add visitor metadata column for webchat
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS visitor_metadata jsonb;
