-- Create catalog_services table
CREATE TABLE public.catalog_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  default_discount NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.catalog_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view catalog in their org"
  ON public.catalog_services FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create catalog in their org"
  ON public.catalog_services FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update catalog in their org"
  ON public.catalog_services FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can delete catalog in their org"
  ON public.catalog_services FOR DELETE
  USING (organization_id = get_user_organization_id());

-- Add discount column to service_items
ALTER TABLE public.service_items 
ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0;

-- Trigger for updated_at
CREATE TRIGGER update_catalog_services_updated_at
  BEFORE UPDATE ON public.catalog_services
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();