-- Add new columns to catalog_services
ALTER TABLE public.catalog_services
ADD COLUMN IF NOT EXISTS estimated_duration TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS checklist_id UUID REFERENCES public.pmoc_checklists(id),
ADD COLUMN IF NOT EXISTS is_non_standard BOOLEAN DEFAULT FALSE;

-- Add new columns to service_items
ALTER TABLE public.service_items
ADD COLUMN IF NOT EXISTS catalog_service_id UUID REFERENCES public.catalog_services(id),
ADD COLUMN IF NOT EXISTS is_non_standard BOOLEAN DEFAULT FALSE;

-- Update service_items to link to catalog_services if possible (fuzzy match on description)
UPDATE public.service_items si
SET catalog_service_id = cs.id
FROM public.catalog_services cs
WHERE si.description = cs.name
AND si.organization_id = cs.organization_id
AND si.catalog_service_id IS NULL;
