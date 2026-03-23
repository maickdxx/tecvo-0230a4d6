
-- 1) Trigger: prevent direct edits on closed snapshot (must reopen first)
CREATE OR REPLACE FUNCTION public.protect_closed_snapshot()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Allow if the update IS a reopen operation (setting reopened_at)
  IF NEW.reopened_at IS NOT NULL AND OLD.reopened_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Allow if already reopened (reopened_at IS NOT NULL) — reclosing
  IF OLD.reopened_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- If currently closed (closed_at set, not reopened), block snapshot field changes
  IF OLD.closed_at IS NOT NULL AND OLD.reopened_at IS NULL THEN
    IF NEW.total_worked_minutes IS DISTINCT FROM OLD.total_worked_minutes
       OR NEW.total_expected_minutes IS DISTINCT FROM OLD.total_expected_minutes
       OR NEW.total_overtime_minutes IS DISTINCT FROM OLD.total_overtime_minutes
       OR NEW.total_absences IS DISTINCT FROM OLD.total_absences
       OR NEW.total_lates IS DISTINCT FROM OLD.total_lates
       OR NEW.bank_balance_minutes IS DISTINCT FROM OLD.bank_balance_minutes
    THEN
      RAISE EXCEPTION 'Período fechado. Reabra o período antes de alterar os valores do snapshot.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_closed_snapshot_trigger ON public.time_clock_month_closures;
CREATE TRIGGER protect_closed_snapshot_trigger
  BEFORE UPDATE ON public.time_clock_month_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_closed_snapshot();

-- 2) Trigger: prevent DELETE on closures (must use reopen)
CREATE OR REPLACE FUNCTION public.prevent_closure_delete()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- Allow service_role (edge functions for team member removal)
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Registros de fechamento não podem ser excluídos. Use a reabertura do período.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_closure_delete_trigger ON public.time_clock_month_closures;
CREATE TRIGGER prevent_closure_delete_trigger
  BEFORE DELETE ON public.time_clock_month_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_closure_delete();

-- 3) Audit trigger for closures (reuse existing audit function)
DROP TRIGGER IF EXISTS audit_closure_changes ON public.time_clock_month_closures;
CREATE TRIGGER audit_closure_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_month_closures
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_time_clock_change();

-- 4) RLS: Only admin/owner can close/reopen
-- First ensure RLS is enabled
ALTER TABLE public.time_clock_month_closures ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate
DROP POLICY IF EXISTS "Admins can manage closures" ON public.time_clock_month_closures;
DROP POLICY IF EXISTS "Org members can view closures" ON public.time_clock_month_closures;
DROP POLICY IF EXISTS "time_clock_month_closures_select" ON public.time_clock_month_closures;
DROP POLICY IF EXISTS "time_clock_month_closures_insert" ON public.time_clock_month_closures;
DROP POLICY IF EXISTS "time_clock_month_closures_update" ON public.time_clock_month_closures;
DROP POLICY IF EXISTS "time_clock_month_closures_delete" ON public.time_clock_month_closures;

-- SELECT: any org member can view
CREATE POLICY "time_clock_month_closures_select"
  ON public.time_clock_month_closures
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- INSERT: only admin/owner
CREATE POLICY "time_clock_month_closures_insert"
  ON public.time_clock_month_closures
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- UPDATE: only admin/owner
CREATE POLICY "time_clock_month_closures_update"
  ON public.time_clock_month_closures
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
  );

-- DELETE: blocked by trigger, but RLS also blocks
CREATE POLICY "time_clock_month_closures_delete"
  ON public.time_clock_month_closures
  FOR DELETE TO authenticated
  USING (false);

-- 5) Flag adjustments made after closure
-- Add column to time_clock_adjustments to track post-closure edits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'time_clock_adjustments'
      AND column_name = 'post_closure'
  ) THEN
    ALTER TABLE public.time_clock_adjustments ADD COLUMN post_closure boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Trigger: auto-flag adjustments targeting entries in a previously-closed period
CREATE OR REPLACE FUNCTION public.flag_post_closure_adjustment()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  entry_recorded_at timestamptz;
  entry_month integer;
  entry_year integer;
  was_closed boolean;
BEGIN
  SELECT recorded_at INTO entry_recorded_at
  FROM public.time_clock_entries
  WHERE id = NEW.entry_id;

  IF entry_recorded_at IS NULL THEN
    RETURN NEW;
  END IF;

  entry_month := EXTRACT(MONTH FROM entry_recorded_at);
  entry_year := EXTRACT(YEAR FROM entry_recorded_at);

  -- Check if this period was EVER closed (even if currently reopened)
  SELECT EXISTS (
    SELECT 1 FROM public.time_clock_month_closures
    WHERE organization_id = NEW.organization_id
      AND user_id = (SELECT user_id FROM public.time_clock_entries WHERE id = NEW.entry_id)
      AND month = entry_month
      AND year = entry_year
      AND closed_at IS NOT NULL
  ) INTO was_closed;

  IF was_closed THEN
    NEW.post_closure := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS flag_post_closure_adjustment_trigger ON public.time_clock_adjustments;
CREATE TRIGGER flag_post_closure_adjustment_trigger
  BEFORE INSERT ON public.time_clock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.flag_post_closure_adjustment();
