
-- Table for multi-equipment support in technical reports
CREATE TABLE public.report_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  equipment_number INTEGER NOT NULL DEFAULT 1,
  
  -- Equipment identification
  equipment_type TEXT,
  equipment_brand TEXT,
  equipment_model TEXT,
  capacity_btus TEXT,
  serial_number TEXT,
  equipment_location TEXT,
  
  -- Checklist per equipment (array of {key, status: ok|attention|critical})
  inspection_checklist JSONB DEFAULT '[]'::jsonb,
  
  -- Structured diagnosis
  condition_found TEXT,
  procedure_performed TEXT,
  technical_observations TEXT,
  
  -- Impact level: low, medium, high
  impact_level TEXT DEFAULT 'low',
  
  -- Services performed on this equipment
  services_performed TEXT,
  
  -- Status fields
  equipment_condition TEXT,
  cleanliness_status TEXT DEFAULT 'clean',
  equipment_working TEXT DEFAULT 'yes',
  
  -- Final status: operational, operational_with_caveats, non_operational
  final_status TEXT DEFAULT 'operational',
  
  -- Measurements
  measurements JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.report_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage report equipment in their org"
  ON public.report_equipment
  FOR ALL
  TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
  ));

-- Index for fast lookups
CREATE INDEX idx_report_equipment_report_id ON public.report_equipment(report_id);
CREATE INDEX idx_report_equipment_org_id ON public.report_equipment(organization_id);
