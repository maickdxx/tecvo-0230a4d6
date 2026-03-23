ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS client_origin text,
  ADD COLUMN IF NOT EXISTS client_type text,
  ADD COLUMN IF NOT EXISTS client_status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS internal_notes text;