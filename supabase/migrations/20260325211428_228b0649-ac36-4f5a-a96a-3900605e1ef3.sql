-- Add new columns to technical_reports for better clarity and legal/technical robustnes
ALTER TABLE public.technical_reports 
ADD COLUMN IF NOT EXISTS cleanliness_status TEXT DEFAULT 'clean',
ADD COLUMN IF NOT EXISTS interventions_performed TEXT;

-- Update existing records if any
UPDATE public.technical_reports SET cleanliness_status = 'clean' WHERE cleanliness_status IS NULL;

-- Create an index for cleanliness_status
CREATE INDEX IF NOT EXISTS idx_technical_reports_cleanliness_status ON public.technical_reports(cleanliness_status);
