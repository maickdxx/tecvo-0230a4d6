
ALTER TABLE public.profiles
  ADD COLUMN field_worker boolean NOT NULL DEFAULT false;

-- Set existing employees as field workers
UPDATE public.profiles p
SET field_worker = true
WHERE EXISTS (
  SELECT 1 FROM public.user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'employee'
);
