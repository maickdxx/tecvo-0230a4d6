-- Create function to sync estimated duration
CREATE OR REPLACE FUNCTION public.sync_service_estimated_duration()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.services s
  SET estimated_duration = (
    SELECT cs.estimated_duration 
    FROM public.service_items si
    JOIN public.catalog_services cs ON si.catalog_service_id = cs.id
    WHERE si.service_id = s.id
    AND cs.estimated_duration IS NOT NULL
    LIMIT 1
  )
  WHERE s.id = COALESCE(NEW.service_id, OLD.service_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger on service_items
DROP TRIGGER IF EXISTS tr_sync_estimated_duration ON public.service_items;
CREATE TRIGGER tr_sync_estimated_duration
AFTER INSERT OR UPDATE OR DELETE ON public.service_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_service_estimated_duration();
