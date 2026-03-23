
-- 1. Bank hours table
CREATE TABLE public.time_clock_bank_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  balance_minutes INTEGER NOT NULL DEFAULT 0,
  carried_from_previous INTEGER NOT NULL DEFAULT 0,
  added_minutes INTEGER NOT NULL DEFAULT 0,
  deducted_minutes INTEGER NOT NULL DEFAULT 0,
  closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, organization_id, month, year)
);

ALTER TABLE public.time_clock_bank_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bank hours"
  ON public.time_clock_bank_hours FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage bank hours"
  ON public.time_clock_bank_hours FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()));

-- 2. Month closures table
CREATE TABLE public.time_clock_month_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year INTEGER NOT NULL,
  closed_by UUID REFERENCES auth.users(id),
  closed_at TIMESTAMPTZ,
  reopened_by UUID REFERENCES auth.users(id),
  reopened_at TIMESTAMPTZ,
  total_worked_minutes INTEGER DEFAULT 0,
  total_expected_minutes INTEGER DEFAULT 0,
  total_overtime_minutes INTEGER DEFAULT 0,
  total_absences INTEGER DEFAULT 0,
  total_lates INTEGER DEFAULT 0,
  bank_balance_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, month, year)
);

ALTER TABLE public.time_clock_month_closures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own month closures"
  ON public.time_clock_month_closures FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage month closures"
  ON public.time_clock_month_closures FOR ALL TO authenticated
  USING (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()))
  WITH CHECK (organization_id = public.get_user_organization_id() AND public.can_modify(auth.uid()));

-- 3. Add photo_required to time_clock_settings
ALTER TABLE public.time_clock_settings ADD COLUMN IF NOT EXISTS photo_required BOOLEAN DEFAULT false;
