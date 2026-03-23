-- 1) Drop the overly permissive ALL policy that allows members to update
DROP POLICY IF EXISTS "Admins can manage month closures" ON public.time_clock_month_closures;

-- 2) Add estimated_cost column for freezing financial value at closure
ALTER TABLE public.time_clock_month_closures ADD COLUMN IF NOT EXISTS estimated_cost numeric DEFAULT NULL;