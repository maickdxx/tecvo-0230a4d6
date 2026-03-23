
-- Add new values to service_type enum
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'maintenance_contract';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'pmoc';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'visit';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'quote';
ALTER TYPE public.service_type ADD VALUE IF NOT EXISTS 'other';
