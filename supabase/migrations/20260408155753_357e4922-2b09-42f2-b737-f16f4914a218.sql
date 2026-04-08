-- Add catalog_service_id to services table (nullable FK)
ALTER TABLE public.services
ADD COLUMN catalog_service_id UUID REFERENCES public.catalog_services(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX idx_services_catalog_service_id ON public.services(catalog_service_id) WHERE catalog_service_id IS NOT NULL;