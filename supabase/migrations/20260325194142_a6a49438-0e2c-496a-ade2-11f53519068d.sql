ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS estimated_duration TEXT;

-- Update existing services with estimated duration from their items if possible
UPDATE public.services s
SET estimated_duration = (
  SELECT cs.estimated_duration 
  FROM public.service_items si
  JOIN public.catalog_services cs ON si.catalog_service_id = cs.id
  WHERE si.service_id = s.id
  AND cs.estimated_duration IS NOT NULL
  LIMIT 1
)
WHERE s.estimated_duration IS NULL;
