
CREATE TABLE IF NOT EXISTS public.external_backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  backup_date text NOT NULL,
  destination text NOT NULL DEFAULT 's3',
  s3_key text NOT NULL,
  size_bytes bigint,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.external_backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view external backup logs"
ON public.external_backup_logs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role full access external backup logs"
ON public.external_backup_logs FOR ALL
USING (true) WITH CHECK (true);
