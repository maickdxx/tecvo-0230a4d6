
-- =============================================
-- Meu Dia v2: Centro de Comando Operacional
-- =============================================

-- 1. New columns on services table (operational, not financial)
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS operational_status text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS travel_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS attendance_started_at timestamptz;

-- 2. Service execution logs table
CREATE TABLE IF NOT EXISTS public.service_execution_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sel_service_id ON public.service_execution_logs(service_id);
CREATE INDEX IF NOT EXISTS idx_sel_org_user ON public.service_execution_logs(organization_id, user_id);

-- 3. Enable RLS
ALTER TABLE public.service_execution_logs ENABLE ROW LEVEL SECURITY;

-- Org-scoped SELECT for managers
CREATE POLICY "Users can view execution logs in their org"
  ON public.service_execution_logs
  FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Org-scoped INSERT for managers
CREATE POLICY "Users can create execution logs in their org"
  ON public.service_execution_logs
  FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Employees can insert their own logs
CREATE POLICY "Employees can insert own execution logs"
  ON public.service_execution_logs
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND is_employee(auth.uid())
    AND organization_id = get_user_organization_id()
  );

-- Employees can view their own logs
CREATE POLICY "Employees can view own execution logs"
  ON public.service_execution_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND is_employee(auth.uid())
  );
