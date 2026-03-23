
-- Replace the broad 'View org expenses' policy with two scoped policies:
-- 1. Employees can only see their own expenses
-- 2. Admins/owners can see all org expenses

DROP POLICY IF EXISTS "View org expenses" ON public.employee_expenses;

-- Employees see only their own expenses
CREATE POLICY "Employees can view own expenses"
ON public.employee_expenses
FOR SELECT
TO authenticated
USING (
  employee_id = auth.uid()
  AND organization_id = get_user_organization_id()
);

-- Admins/owners can view all org expenses (for approval workflows)
CREATE POLICY "Admins can view all org expenses"
ON public.employee_expenses
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
  AND can_modify(auth.uid())
);
