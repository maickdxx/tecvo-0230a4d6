
-- =====================================================
-- CORREÇÃO 1: Permitir que funcionários solicitem ajustes de ponto
-- =====================================================

-- Add INSERT policy for employees to request their own adjustments
CREATE POLICY "Employees can request own adjustments"
ON public.time_clock_adjustments
FOR INSERT TO authenticated
WITH CHECK (
  requested_by = auth.uid()
  AND status = 'pending'
  AND organization_id = get_user_organization_id()
);

-- =====================================================
-- CORREÇÃO 2: Adicionar updated_at na tabela time_clock_adjustments
-- =====================================================

ALTER TABLE public.time_clock_adjustments
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER trg_time_clock_adjustments_updated_at
BEFORE UPDATE ON public.time_clock_adjustments
FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- =====================================================
-- CORREÇÃO 3: Automatizar audit log via triggers
-- =====================================================

-- Generic audit function for time_clock tables
CREATE OR REPLACE FUNCTION public.audit_time_clock_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.time_clock_audit_log (
      organization_id, user_id, action, table_name, record_id, new_data
    ) VALUES (
      NEW.organization_id,
      COALESCE(auth.uid(), NEW.user_id),
      'INSERT',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.time_clock_audit_log (
      organization_id, user_id, action, table_name, record_id, old_data, new_data
    ) VALUES (
      NEW.organization_id,
      COALESCE(auth.uid(), NEW.user_id),
      'UPDATE',
      TG_TABLE_NAME,
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_clock_audit_log (
      organization_id, user_id, action, table_name, record_id, old_data
    ) VALUES (
      OLD.organization_id,
      COALESCE(auth.uid(), OLD.user_id),
      'DELETE',
      TG_TABLE_NAME,
      OLD.id,
      to_jsonb(OLD)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger on time_clock_adjustments
CREATE TRIGGER trg_audit_time_clock_adjustments
AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_adjustments
FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();

-- Trigger on time_clock_month_closures
CREATE TRIGGER trg_audit_time_clock_month_closures
AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_month_closures
FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();

-- Trigger on time_clock_work_schedules
CREATE TRIGGER trg_audit_time_clock_work_schedules
AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_work_schedules
FOR EACH ROW EXECUTE FUNCTION audit_time_clock_change();

-- =====================================================
-- CORREÇÃO 4: Blindar audit log contra alteração e exclusão
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_time_clock_audit_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Time clock audit log entries are immutable and cannot be modified or deleted';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_audit_log_update
BEFORE UPDATE ON public.time_clock_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_time_clock_audit_modification();

CREATE TRIGGER trg_prevent_audit_log_delete
BEFORE DELETE ON public.time_clock_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_time_clock_audit_modification();

-- =====================================================
-- CORREÇÃO 5: Proteger inconsistências contra exclusão
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_time_clock_inconsistency_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Time clock inconsistencies cannot be deleted. Use status update instead.';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_prevent_inconsistency_delete
BEFORE DELETE ON public.time_clock_inconsistencies
FOR EACH ROW EXECUTE FUNCTION prevent_time_clock_inconsistency_delete();
