
-- Table to track auto messages for rate limiting
CREATE TABLE public.auto_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  message_type text NOT NULL,
  sent_at timestamptz DEFAULT now(),
  content text
);

ALTER TABLE public.auto_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.auto_message_log
  FOR ALL USING (false);

CREATE INDEX idx_auto_message_log_org_date ON public.auto_message_log(organization_id, sent_at);

-- Enable pg_net and pg_cron extensions
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA extensions;

-- Trigger function to notify on service status changes
CREATE OR REPLACE FUNCTION public.notify_service_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_url text := 'https://vcuwimodpfbzpuvzesfm.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s';
  old_op_status text;
  new_op_status text;
  old_status text;
  new_status text;
BEGIN
  old_op_status := COALESCE(OLD.operational_status, '');
  new_op_status := COALESCE(NEW.operational_status, '');
  old_status := OLD.status::text;
  new_status := NEW.status::text;

  -- Check if relevant status changed
  IF (new_op_status IN ('en_route', 'in_attendance') AND new_op_status != old_op_status)
     OR (new_status = 'completed' AND old_status != 'completed')
  THEN
    BEGIN
      PERFORM net.http_post(
        url := base_url || '/functions/v1/auto-service-notify',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || anon_key
        ),
        body := jsonb_build_object(
          'service_id', NEW.id,
          'organization_id', NEW.organization_id,
          'new_operational_status', new_op_status,
          'new_status', new_status,
          'old_status', old_status
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'notify_service_status_change http call failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_service_status_change
  AFTER UPDATE ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_service_status_change();
