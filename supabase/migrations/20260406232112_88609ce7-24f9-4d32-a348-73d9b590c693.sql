
-- Add PDF state tracking columns to services
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS pdf_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS pdf_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_pdf_sent_at timestamptz;

-- Add index for queries filtering by pdf_status
CREATE INDEX IF NOT EXISTS idx_services_pdf_status ON public.services (pdf_status) WHERE pdf_status != 'ready';
