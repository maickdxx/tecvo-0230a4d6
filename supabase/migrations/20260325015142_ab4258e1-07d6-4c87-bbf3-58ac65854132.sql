
-- Per-equipment report data for the execution mode
CREATE TABLE public.equipment_report_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  equipment_id UUID NOT NULL REFERENCES public.service_equipment(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.technical_reports(id) ON DELETE SET NULL,
  service_type_performed TEXT,
  problem_identified TEXT,
  work_performed TEXT,
  observations TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(service_id, equipment_id)
);

-- Add equipment_id to technical_report_photos for per-equipment photo linking
ALTER TABLE public.technical_report_photos
  ADD COLUMN IF NOT EXISTS equipment_id UUID REFERENCES public.service_equipment(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.equipment_report_data ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own org equipment report data"
  ON public.equipment_report_data FOR SELECT TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can insert own org equipment report data"
  ON public.equipment_report_data FOR INSERT TO authenticated
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can update own org equipment report data"
  ON public.equipment_report_data FOR UPDATE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

CREATE POLICY "Users can delete own org equipment report data"
  ON public.equipment_report_data FOR DELETE TO authenticated
  USING (organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));
