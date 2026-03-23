
CREATE OR REPLACE FUNCTION public.notify_whatsapp_owner_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url text := 'https://vcuwimodpfbzpuvzesfm.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s';
BEGIN
  -- Only fire when whatsapp_owner goes from empty/null to a value
  IF (OLD.whatsapp_owner IS NULL OR OLD.whatsapp_owner = '')
     AND NEW.whatsapp_owner IS NOT NULL
     AND NEW.whatsapp_owner != ''
  THEN
    BEGIN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/broadcast-secretary',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'single_org_id', NEW.id
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_whatsapp_owner_welcome http call failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_whatsapp_owner_set
  AFTER UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_whatsapp_owner_welcome();
