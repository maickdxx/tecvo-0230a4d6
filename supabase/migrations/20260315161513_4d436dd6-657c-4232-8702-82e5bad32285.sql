
-- Create storage bucket for time clock photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('time-clock-photos', 'time-clock-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for time clock photos
CREATE POLICY "Users can upload own time clock photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'time-clock-photos' AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Org members can view time clock photos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'time-clock-photos' AND (storage.foldername(name))[1] = (SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()));
