
CREATE OR REPLACE FUNCTION public.audit_time_clock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  audit_user_id uuid;
  audit_org_id uuid;
  audit_record_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    audit_org_id := OLD.organization_id;
    audit_record_id := OLD.id;
    -- Resolve user_id based on table
    IF TG_TABLE_NAME = 'time_clock_adjustments' THEN
      audit_user_id := COALESCE(auth.uid(), OLD.adjusted_by);
    ELSE
      audit_user_id := COALESCE(auth.uid(), OLD.user_id);
    END IF;

    INSERT INTO public.time_clock_audit_log (
      organization_id, user_id, action, table_name, record_id, old_data
    ) VALUES (
      audit_org_id, audit_user_id, 'DELETE', TG_TABLE_NAME, audit_record_id, to_jsonb(OLD)
    );
    RETURN OLD;
  ELSE
    -- INSERT or UPDATE
    audit_org_id := NEW.organization_id;
    audit_record_id := NEW.id;
    IF TG_TABLE_NAME = 'time_clock_adjustments' THEN
      audit_user_id := COALESCE(auth.uid(), NEW.requested_by, NEW.adjusted_by);
    ELSE
      audit_user_id := COALESCE(auth.uid(), NEW.user_id);
    END IF;

    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.time_clock_audit_log (
        organization_id, user_id, action, table_name, record_id, new_data
      ) VALUES (
        audit_org_id, audit_user_id, 'INSERT', TG_TABLE_NAME, audit_record_id, to_jsonb(NEW)
      );
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.time_clock_audit_log (
        organization_id, user_id, action, table_name, record_id, old_data, new_data
      ) VALUES (
        audit_org_id, audit_user_id, 'UPDATE', TG_TABLE_NAME, audit_record_id, to_jsonb(OLD), to_jsonb(NEW)
      );
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
