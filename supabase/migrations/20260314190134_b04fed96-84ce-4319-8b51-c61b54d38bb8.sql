
-- Add time_clock_enabled to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS time_clock_enabled boolean NOT NULL DEFAULT false;

-- Add employee_type to profiles (tecnico, ajudante, atendente)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_type text NOT NULL DEFAULT 'tecnico';
