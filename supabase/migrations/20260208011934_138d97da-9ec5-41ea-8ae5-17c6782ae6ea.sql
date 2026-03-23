-- Add service address fields to services table
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS service_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS service_street TEXT,
  ADD COLUMN IF NOT EXISTS service_number TEXT,
  ADD COLUMN IF NOT EXISTS service_complement TEXT,
  ADD COLUMN IF NOT EXISTS service_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS service_city TEXT,
  ADD COLUMN IF NOT EXISTS service_state TEXT;