-- Add missing columns to service_items for snapshotting and persistence
ALTER TABLE public.service_items 
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS estimated_duration TEXT,
ADD COLUMN IF NOT EXISTS standard_checklist JSONB;

-- Update existing service_items with data from catalog_services where possible (optional but good for consistency)
UPDATE public.service_items si
SET 
  name = cs.name,
  category = cs.category,
  estimated_duration = cs.estimated_duration,
  standard_checklist = cs.standard_checklist
FROM public.catalog_services cs
WHERE si.catalog_service_id = cs.id
AND si.name IS NULL;

-- Ensure RLS is enabled and policies are correct (assuming they are already set up for basic fields)
-- If we need to add specific policies for these new columns, we can, but usually they are covered by table-level RLS.

-- Create a function to calculate total duration of a service based on its items
CREATE OR REPLACE FUNCTION public.calculate_service_total_duration(s_id UUID)
RETURNS TEXT AS $$
DECLARE
    total_minutes INTEGER := 0;
    item_duration TEXT;
    item_minutes INTEGER;
BEGIN
    FOR item_duration IN 
        SELECT estimated_duration FROM public.service_items WHERE service_id = s_id AND estimated_duration IS NOT NULL
    LOOP
        -- Simple parsing of "HH:MM" or similar formats. 
        -- Assuming format is "HH:MM" or "Xh Ym" or just minutes.
        -- We'll try to extract numbers.
        BEGIN
            -- Try to parse common formats
            IF item_duration ~ '^[0-9]+$' THEN
                item_minutes := item_duration::INTEGER;
            ELSIF item_duration ~ '^[0-9]+:[0-9]+$' THEN
                item_minutes := (split_part(item_duration, ':', 1)::INTEGER * 60) + split_part(item_duration, ':', 2)::INTEGER;
            ELSE
                -- Fallback: just try to extract the first number found
                item_minutes := (substring(item_duration from '[0-9]+'))::INTEGER;
            END IF;
            
            total_minutes := total_minutes + item_minutes;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore parsing errors for individual items
        END;
    END LOOP;

    IF total_minutes = 0 THEN
        RETURN NULL;
    END IF;

    RETURN (total_minutes / 60)::TEXT || ':' || LPAD((total_minutes % 60)::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to update services.estimated_duration when service_items are modified
CREATE OR REPLACE FUNCTION public.sync_service_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE public.services 
        SET estimated_duration = public.calculate_service_total_duration(OLD.service_id)
        WHERE id = OLD.service_id;
        RETURN OLD;
    ELSE
        UPDATE public.services 
        SET estimated_duration = public.calculate_service_total_duration(NEW.service_id)
        WHERE id = NEW.service_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_service_duration ON public.service_items;
CREATE TRIGGER tr_sync_service_duration
AFTER INSERT OR UPDATE OR DELETE ON public.service_items
FOR EACH ROW EXECUTE FUNCTION public.sync_service_duration();
