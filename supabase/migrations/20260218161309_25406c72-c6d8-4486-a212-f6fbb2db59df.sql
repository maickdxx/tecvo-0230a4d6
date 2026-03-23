
-- Remove the default that uses the global sequence
ALTER TABLE public.services ALTER COLUMN quote_number DROP DEFAULT;

-- Create a function to generate per-organization quote numbers
CREATE OR REPLACE FUNCTION public.set_quote_number_per_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  next_number integer;
BEGIN
  -- Get the next number for this organization
  SELECT COALESCE(MAX(quote_number), 0) + 1 INTO next_number
  FROM public.services
  WHERE organization_id = NEW.organization_id;

  NEW.quote_number := next_number;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set quote_number on insert
CREATE TRIGGER set_service_quote_number
BEFORE INSERT ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.set_quote_number_per_org();

-- Reset existing quote_numbers per organization (re-number sequentially)
WITH numbered AS (
  SELECT id, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) AS new_number
  FROM public.services
)
UPDATE public.services s
SET quote_number = n.new_number
FROM numbered n
WHERE s.id = n.id;
