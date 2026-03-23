
-- Fix: Change data_audit_log FK to SET NULL on delete to prevent circular dependency
-- when deleting organizations (the audit trigger tries to insert with the org_id being deleted)
ALTER TABLE public.data_audit_log 
  DROP CONSTRAINT IF EXISTS data_audit_log_organization_id_fkey;

ALTER TABLE public.data_audit_log 
  ADD CONSTRAINT data_audit_log_organization_id_fkey 
  FOREIGN KEY (organization_id) 
  REFERENCES public.organizations(id) 
  ON DELETE SET NULL;
