
-- Calendar events table for holidays, vacations, sick leave, etc.
CREATE TABLE public.time_clock_calendar_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NULL, -- NULL means applies to entire org (e.g., holidays)
  event_type text NOT NULL DEFAULT 'holiday', -- holiday, vacation, sick_leave, leave, day_off, bonus
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  notes text NULL,
  created_by uuid NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_clock_calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar events in their org"
  ON public.time_clock_calendar_events FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage calendar events"
  ON public.time_clock_calendar_events FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()));

-- Work schedules table
CREATE TABLE public.time_clock_work_schedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NULL, -- NULL = org default; set = per-employee
  employee_type text NULL, -- NULL = any; set = per-role (tecnico, ajudante, atendente)
  schedule_name text NOT NULL DEFAULT 'Padrão',
  schedule_type text NOT NULL DEFAULT '5x2', -- 5x2, 6x1, custom
  work_days jsonb NOT NULL DEFAULT '["seg","ter","qua","qui","sex"]'::jsonb,
  expected_clock_in time without time zone NOT NULL DEFAULT '08:00',
  expected_clock_out time without time zone NOT NULL DEFAULT '17:48',
  work_hours_per_day numeric NOT NULL DEFAULT 8.8,
  break_minutes integer NOT NULL DEFAULT 60,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.time_clock_work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view work schedules in their org"
  ON public.time_clock_work_schedules FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage work schedules"
  ON public.time_clock_work_schedules FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()));

-- Add adjustment request fields to time_clock_adjustments
ALTER TABLE public.time_clock_adjustments 
  ADD COLUMN IF NOT EXISTS requested_by uuid NULL,
  ADD COLUMN IF NOT EXISTS request_reason text NULL,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS original_time timestamp with time zone NULL,
  ADD COLUMN IF NOT EXISTS adjustment_type text NOT NULL DEFAULT 'manual';

-- Add more fields to time_clock_inconsistencies for better tracking  
ALTER TABLE public.time_clock_inconsistencies
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS auto_detected boolean NOT NULL DEFAULT true;
