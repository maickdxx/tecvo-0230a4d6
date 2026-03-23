
ALTER TABLE public.service_payments
  ADD COLUMN registered_by uuid DEFAULT NULL;

-- Backfill: set registered_by from services.assigned_to for existing payments
UPDATE public.service_payments sp
SET registered_by = s.assigned_to
FROM public.services s
WHERE sp.service_id = s.id AND s.assigned_to IS NOT NULL;
