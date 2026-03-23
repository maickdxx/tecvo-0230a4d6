
-- Recurrence config per organization
CREATE TABLE IF NOT EXISTS public.recurrence_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_enabled boolean NOT NULL DEFAULT false,
  daily_limit integer NOT NULL DEFAULT 20,
  business_hours_start text NOT NULL DEFAULT '08:00',
  business_hours_end text NOT NULL DEFAULT '18:00',
  message_2_months text,
  message_4_months text,
  message_6_months text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.recurrence_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org recurrence config"
  ON public.recurrence_config FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Recurrence entries (one per client per cycle)
CREATE TABLE IF NOT EXISTS public.recurrence_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  source_service_type text NOT NULL,
  source_completed_date timestamptz NOT NULL,
  source_value numeric,
  stage text NOT NULL DEFAULT 'aguardando',
  next_action_date date,
  is_active boolean NOT NULL DEFAULT true,
  msg_2m_sent_at timestamptz,
  msg_4m_sent_at timestamptz,
  msg_6m_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, client_id, source_service_id)
);

ALTER TABLE public.recurrence_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own org recurrence entries"
  ON public.recurrence_entries FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Message log for audit
CREATE TABLE IF NOT EXISTS public.recurrence_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recurrence_entry_id uuid REFERENCES public.recurrence_entries(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  content text,
  status text NOT NULL DEFAULT 'sent',
  sent_at timestamptz NOT NULL DEFAULT now(),
  error_message text
);

ALTER TABLE public.recurrence_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org recurrence logs"
  ON public.recurrence_message_log FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (organization_id IN (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()));

-- Recreate the trigger function
CREATE OR REPLACE FUNCTION public.auto_create_recurrence_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed')
     AND NEW.service_type::text IN ('cleaning', 'installation')
     AND NEW.client_id IS NOT NULL
     AND NEW.completed_date IS NOT NULL
  THEN
    UPDATE public.recurrence_entries
    SET is_active = false, updated_at = now()
    WHERE organization_id = NEW.organization_id
      AND client_id = NEW.client_id
      AND is_active = true;

    INSERT INTO public.recurrence_entries (
      organization_id, client_id, source_service_id, source_service_type,
      source_completed_date, source_value, stage, next_action_date
    ) VALUES (
      NEW.organization_id, NEW.client_id, NEW.id, NEW.service_type::text,
      NEW.completed_date, NEW.value, 'aguardando',
      (NEW.completed_date + interval '2 months')::date
    )
    ON CONFLICT (organization_id, client_id, source_service_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recurrence_entry ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_recurrence_entry();

DROP TRIGGER IF EXISTS trg_auto_recurrence_entry_insert ON public.services;
CREATE TRIGGER trg_auto_recurrence_entry_insert
  AFTER INSERT ON public.services
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.service_type::text IN ('cleaning', 'installation') AND NEW.client_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_create_recurrence_entry();

-- BACKFILL: Insert recurrence entries for all existing completed cleaning/installation services
-- For each client, only keep the most recent eligible service as active
INSERT INTO public.recurrence_entries (
  organization_id, client_id, source_service_id, source_service_type,
  source_completed_date, source_value, stage, next_action_date, is_active
)
SELECT
  s.organization_id,
  s.client_id,
  s.id,
  s.service_type::text,
  s.completed_date,
  s.value,
  'aguardando',
  (s.completed_date + interval '2 months')::date,
  -- Only the most recent service per client per org is active
  (s.completed_date = latest.max_date)
FROM public.services s
JOIN (
  SELECT organization_id, client_id, MAX(completed_date) as max_date
  FROM public.services
  WHERE status = 'completed'
    AND service_type::text IN ('cleaning', 'installation')
    AND completed_date IS NOT NULL
    AND client_id IS NOT NULL
    AND deleted_at IS NULL
  GROUP BY organization_id, client_id
) latest ON s.organization_id = latest.organization_id AND s.client_id = latest.client_id
WHERE s.status = 'completed'
  AND s.service_type::text IN ('cleaning', 'installation')
  AND s.completed_date IS NOT NULL
  AND s.client_id IS NOT NULL
  AND s.deleted_at IS NULL
ON CONFLICT (organization_id, client_id, source_service_id) DO NOTHING;
