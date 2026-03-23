
CREATE TABLE public.client_portal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  display_name text,
  welcome_message text DEFAULT 'Acompanhe seus serviços com segurança',
  contact_phone text,
  logo_url text,
  primary_color text DEFAULT '#1e6bb8',
  secondary_color text,
  slug text,
  custom_domain text,
  domain_status text NOT NULL DEFAULT 'not_configured',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id),
  UNIQUE(slug)
);

ALTER TABLE public.client_portal_config ENABLE ROW LEVEL SECURITY;

-- Members of the org can read
CREATE POLICY "org_members_read_portal_config" ON public.client_portal_config
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND organization_id = client_portal_config.organization_id)
  );

-- Owners and admins can modify
CREATE POLICY "org_admins_manage_portal_config" ON public.client_portal_config
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.user_id = auth.uid()
        AND p.organization_id = client_portal_config.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.user_id = auth.uid()
        AND p.organization_id = client_portal_config.organization_id
        AND ur.role IN ('owner', 'admin')
    )
  );

-- Public read for portal rendering (by slug)
CREATE POLICY "public_read_portal_config_by_slug" ON public.client_portal_config
  FOR SELECT TO anon
  USING (slug IS NOT NULL AND is_active = true);

-- RPC to get portal config by slug (public)
CREATE OR REPLACE FUNCTION public.get_portal_config_by_slug(_slug text)
RETURNS TABLE(
  organization_id uuid,
  display_name text,
  welcome_message text,
  contact_phone text,
  logo_url text,
  primary_color text,
  secondary_color text,
  is_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id, display_name, welcome_message, contact_phone, logo_url,
         primary_color, secondary_color, is_active
  FROM public.client_portal_config
  WHERE slug = _slug AND is_active = true
  LIMIT 1;
$$;
