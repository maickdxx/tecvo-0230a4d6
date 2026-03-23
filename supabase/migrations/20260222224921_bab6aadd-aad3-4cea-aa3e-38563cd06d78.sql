
-- Table to store operational capacity configuration per organization
CREATE TABLE public.operational_capacity_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  active_teams integer NOT NULL DEFAULT 1,
  schedule_mode text NOT NULL DEFAULT 'total_hours',
  start_time time NULL,
  end_time time NULL,
  break_minutes integer NULL DEFAULT 0,
  total_minutes_per_day integer NOT NULL DEFAULT 528,
  works_saturday boolean NOT NULL DEFAULT false,
  saturday_minutes integer NULL DEFAULT 0,
  default_travel_minutes integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.operational_capacity_config ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their org config"
  ON public.operational_capacity_config FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert their org config"
  ON public.operational_capacity_config FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid()));

CREATE POLICY "Users can update their org config"
  ON public.operational_capacity_config FOR UPDATE
  USING (organization_id = get_user_organization_id() AND can_modify(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_operational_capacity_config_updated_at
  BEFORE UPDATE ON public.operational_capacity_config
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
