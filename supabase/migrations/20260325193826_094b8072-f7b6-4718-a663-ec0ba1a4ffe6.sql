ALTER TABLE public.catalog_services
ADD COLUMN IF NOT EXISTS standard_checklist JSONB DEFAULT '[]'::jsonb;
