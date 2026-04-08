
-- Step 1: Create new can_modify with explicit _org_id parameter
CREATE OR REPLACE FUNCTION public.can_modify(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin', 'member')
      AND organization_id = _org_id
  )
$$;

-- Step 2: Replace old single-param can_modify to use the new one (backward compat)
CREATE OR REPLACE FUNCTION public.can_modify(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.can_modify(_user_id, public.get_user_organization_id())
$$;

-- Step 3: Drop and recreate all 25 policies to use can_modify(auth.uid(), table.organization_id)

-- services (4 policies)
DROP POLICY IF EXISTS "Users can create services in their organization" ON public.services;
CREATE POLICY "Users can create services in their organization" ON public.services
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update services in their organization" ON public.services;
CREATE POLICY "Users can update services in their organization" ON public.services
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete services in their organization" ON public.services;
CREATE POLICY "Users can delete services in their organization" ON public.services
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can view services in their organization" ON public.services;
CREATE POLICY "Users can view services in their organization" ON public.services
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id))
    OR (assigned_to = auth.uid() AND is_employee(auth.uid()))
  )
);

-- clients (2 policies)
DROP POLICY IF EXISTS "Users can update clients in their organization" ON public.clients;
CREATE POLICY "Users can update clients in their organization" ON public.clients
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete clients in their organization" ON public.clients;
CREATE POLICY "Users can delete clients in their organization" ON public.clients
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- transactions (2 policies)
DROP POLICY IF EXISTS "Users can delete transactions in their organization" ON public.transactions;
CREATE POLICY "Users can delete transactions in their organization" ON public.transactions
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update transactions in their organization" ON public.transactions;
CREATE POLICY "Users can update transactions in their organization" ON public.transactions
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- employee_expenses (3 policies)
DROP POLICY IF EXISTS "Update org expenses" ON public.employee_expenses;
CREATE POLICY "Update org expenses" ON public.employee_expenses
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Delete org expenses" ON public.employee_expenses;
CREATE POLICY "Delete org expenses" ON public.employee_expenses
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND (can_modify(auth.uid(), organization_id) OR (employee_id = auth.uid() AND status = 'pending')));

DROP POLICY IF EXISTS "Admins can view all org expenses" ON public.employee_expenses;
CREATE POLICY "Admins can view all org expenses" ON public.employee_expenses
FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- time_clock_inconsistencies (1 policy)
DROP POLICY IF EXISTS "Admins can update inconsistencies" ON public.time_clock_inconsistencies;
CREATE POLICY "Admins can update inconsistencies" ON public.time_clock_inconsistencies
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- pmoc_contracts (3 policies)
DROP POLICY IF EXISTS "Users can create pmoc_contracts in their org" ON public.pmoc_contracts;
CREATE POLICY "Users can create pmoc_contracts in their org" ON public.pmoc_contracts
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update pmoc_contracts in their org" ON public.pmoc_contracts;
CREATE POLICY "Users can update pmoc_contracts in their org" ON public.pmoc_contracts
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete pmoc_contracts in their org" ON public.pmoc_contracts;
CREATE POLICY "Users can delete pmoc_contracts in their org" ON public.pmoc_contracts
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- pmoc_equipment (3 policies)
DROP POLICY IF EXISTS "Users can create pmoc_equipment in their org" ON public.pmoc_equipment;
CREATE POLICY "Users can create pmoc_equipment in their org" ON public.pmoc_equipment
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update pmoc_equipment in their org" ON public.pmoc_equipment;
CREATE POLICY "Users can update pmoc_equipment in their org" ON public.pmoc_equipment
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can delete pmoc_equipment in their org" ON public.pmoc_equipment;
CREATE POLICY "Users can delete pmoc_equipment in their org" ON public.pmoc_equipment
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- operational_capacity_config (2 policies)
DROP POLICY IF EXISTS "Users can insert their org config" ON public.operational_capacity_config;
CREATE POLICY "Users can insert their org config" ON public.operational_capacity_config
FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update their org config" ON public.operational_capacity_config;
CREATE POLICY "Users can update their org config" ON public.operational_capacity_config
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- service_payments (2 policies)
DROP POLICY IF EXISTS "Users can delete service payments in their org" ON public.service_payments;
CREATE POLICY "Users can delete service payments in their org" ON public.service_payments
FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

DROP POLICY IF EXISTS "Users can update service payments in their org" ON public.service_payments;
CREATE POLICY "Users can update service payments in their org" ON public.service_payments
FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- time_clock_calendar_events (1 policy - ALL)
DROP POLICY IF EXISTS "Admins can manage calendar events" ON public.time_clock_calendar_events;
CREATE POLICY "Admins can manage calendar events" ON public.time_clock_calendar_events
FOR ALL TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id))
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- time_clock_work_schedules (1 policy - ALL)
DROP POLICY IF EXISTS "Admins can manage work schedules" ON public.time_clock_work_schedules;
CREATE POLICY "Admins can manage work schedules" ON public.time_clock_work_schedules
FOR ALL TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id))
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));

-- time_clock_bank_hours (1 policy - ALL)
DROP POLICY IF EXISTS "Admins can manage bank hours" ON public.time_clock_bank_hours;
CREATE POLICY "Admins can manage bank hours" ON public.time_clock_bank_hours
FOR ALL TO authenticated
USING (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id))
WITH CHECK (organization_id = get_user_organization_id() AND can_modify(auth.uid(), organization_id));
