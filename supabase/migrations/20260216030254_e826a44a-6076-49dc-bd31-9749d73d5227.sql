ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS page_tutorials_seen jsonb NOT NULL DEFAULT '[]'::jsonb;