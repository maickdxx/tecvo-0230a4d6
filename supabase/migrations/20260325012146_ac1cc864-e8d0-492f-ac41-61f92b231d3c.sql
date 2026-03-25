
-- Create table for technical report photos
CREATE TABLE public.technical_report_photos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.technical_reports(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  category TEXT NOT NULL DEFAULT 'problem' CHECK (category IN ('before', 'after', 'problem')),
  photo_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.technical_report_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org report photos"
  ON public.technical_report_photos FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org report photos"
  ON public.technical_report_photos FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete own org report photos"
  ON public.technical_report_photos FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Index
CREATE INDEX idx_report_photos_report_id ON public.technical_report_photos(report_id);

-- Storage bucket for report photos
INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload report photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'report-photos');

CREATE POLICY "Anyone can view report photos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'report-photos');

CREATE POLICY "Authenticated users can delete report photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'report-photos');
