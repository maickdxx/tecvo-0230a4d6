-- Add plan fields to organizations
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ;

-- Create organization_usage table to track monthly service creation
CREATE TABLE IF NOT EXISTS public.organization_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL,
  services_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, month_year)
);

-- Enable RLS
ALTER TABLE public.organization_usage ENABLE ROW LEVEL SECURITY;

-- RLS policy for viewing usage
CREATE POLICY "Users can view their org usage"
  ON public.organization_usage FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Function to increment services count on creation
CREATE OR REPLACE FUNCTION public.increment_services_count()
RETURNS TRIGGER AS $$
DECLARE
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');
  
  INSERT INTO public.organization_usage (organization_id, month_year, services_created)
  VALUES (NEW.organization_id, current_month, 1)
  ON CONFLICT (organization_id, month_year)
  DO UPDATE SET 
    services_created = organization_usage.services_created + 1,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to count service creation
DROP TRIGGER IF EXISTS on_service_created ON public.services;
CREATE TRIGGER on_service_created
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_services_count();

-- Function to check if org can create more services
CREATE OR REPLACE FUNCTION public.can_create_service(org_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  org_plan TEXT;
  current_usage INTEGER;
  current_month TEXT;
BEGIN
  current_month := to_char(NOW(), 'YYYY-MM');
  
  -- Get organization plan
  SELECT plan INTO org_plan FROM public.organizations WHERE id = org_id;
  
  -- PRO plan has no limits
  IF org_plan = 'pro' THEN
    RETURN TRUE;
  END IF;
  
  -- Check current month usage for free plan
  SELECT COALESCE(services_created, 0) INTO current_usage
  FROM public.organization_usage
  WHERE organization_id = org_id AND month_year = current_month;
  
  -- Free plan limit is 15
  RETURN COALESCE(current_usage, 0) < 15;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;