
CREATE OR REPLACE FUNCTION public.audit_destructive_operation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_org_id uuid;
  v_record_id uuid;
  v_old_jsonb jsonb;
  v_new_jsonb jsonb;
BEGIN
  v_old_jsonb := to_jsonb(OLD);
  
  v_org_id := (v_old_jsonb ->> 'organization_id')::uuid;
  v_record_id := (v_old_jsonb ->> 'id')::uuid;

  IF TG_OP = 'DELETE' THEN
    BEGIN
      INSERT INTO public.data_audit_log (organization_id, user_id, table_name, operation, record_id, old_data)
      VALUES (v_org_id, auth.uid(), TG_TABLE_NAME, 'DELETE', v_record_id, v_old_jsonb);
    EXCEPTION WHEN foreign_key_violation THEN
      -- If the org is being deleted, log without org reference
      INSERT INTO public.data_audit_log (organization_id, user_id, table_name, operation, record_id, old_data)
      VALUES (NULL, auth.uid(), TG_TABLE_NAME, 'DELETE', v_record_id, v_old_jsonb);
    END;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_new_jsonb := to_jsonb(NEW);
    INSERT INTO public.data_audit_log (organization_id, user_id, table_name, operation, record_id, old_data, new_data)
    VALUES (
      COALESCE((v_new_jsonb ->> 'organization_id')::uuid, v_org_id),
      auth.uid(),
      TG_TABLE_NAME,
      'UPDATE',
      COALESCE((v_new_jsonb ->> 'id')::uuid, v_record_id),
      v_old_jsonb,
      v_new_jsonb
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$
