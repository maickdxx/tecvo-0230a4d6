ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS activation_step text NOT NULL DEFAULT 'welcome';

COMMENT ON COLUMN public.organizations.activation_step IS 'Tracks user activation progress: welcome, create_os, completed';