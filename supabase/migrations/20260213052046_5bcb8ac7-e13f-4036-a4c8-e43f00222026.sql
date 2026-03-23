-- Drop the restrictive check constraint and replace with one that includes all valid plans
ALTER TABLE public.organizations DROP CONSTRAINT organizations_plan_check;

ALTER TABLE public.organizations ADD CONSTRAINT organizations_plan_check 
  CHECK (plan = ANY (ARRAY['free'::text, 'starter'::text, 'essential'::text, 'pro'::text]));
