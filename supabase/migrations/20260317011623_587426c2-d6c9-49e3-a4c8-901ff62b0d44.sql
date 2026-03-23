
-- Technical Reports table
CREATE TABLE public.technical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  report_number integer NOT NULL DEFAULT 0,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  service_id uuid REFERENCES public.services(id),
  quote_service_id uuid REFERENCES public.services(id),
  technician_id uuid,
  report_date timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'draft',
  
  -- Equipment
  equipment_type text,
  equipment_brand text,
  equipment_model text,
  capacity_btus text,
  serial_number text,
  equipment_quantity integer DEFAULT 1,
  equipment_location text,
  
  -- Content
  visit_reason text,
  inspection_checklist jsonb DEFAULT '[]'::jsonb,
  diagnosis text,
  measurements jsonb DEFAULT '{}'::jsonb,
  equipment_condition text,
  recommendation text,
  risks text,
  conclusion text,
  observations text,
  
  -- Structured fields
  needs_quote boolean DEFAULT false,
  equipment_working text DEFAULT 'yes',
  responsible_technician_name text,
  
  -- Timestamps
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.technical_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own org reports"
  ON public.technical_reports FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org reports"
  ON public.technical_reports FOR INSERT
  TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own org reports"
  ON public.technical_reports FOR UPDATE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete own org reports"
  ON public.technical_reports FOR DELETE
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Auto-increment report number per org
CREATE OR REPLACE FUNCTION public.set_report_number_per_org()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  next_number integer;
BEGIN
  SELECT COALESCE(MAX(report_number), 0) + 1 INTO next_number
  FROM public.technical_reports
  WHERE organization_id = NEW.organization_id;
  NEW.report_number := next_number;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER set_report_number
  BEFORE INSERT ON public.technical_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_report_number_per_org();

-- Updated_at trigger
CREATE TRIGGER handle_technical_reports_updated_at
  BEFORE UPDATE ON public.technical_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Index for performance
CREATE INDEX idx_technical_reports_org ON public.technical_reports(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_technical_reports_client ON public.technical_reports(client_id);
CREATE INDEX idx_technical_reports_service ON public.technical_reports(service_id) WHERE service_id IS NOT NULL;
