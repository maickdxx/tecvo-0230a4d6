-- Fix: Remove auto_notify_client_completion gate from owner operational notifications
-- That flag should only control client portal link sending, not owner notifications
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

  -- Check if relevant status changed (no more auto_notify gate here - that's for client portal only)
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

-- Add service_id and send_status columns to auto_message_log for better idempotency
ALTER TABLE public.auto_message_log ADD COLUMN IF NOT EXISTS service_id uuid;
ALTER TABLE public.auto_message_log ADD COLUMN IF NOT EXISTS send_status text DEFAULT 'sent';

-- Index for idempotency checks
CREATE INDEX IF NOT EXISTS idx_auto_message_log_service_event 
ON public.auto_message_log(organization_id, service_id, message_type, sent_at);