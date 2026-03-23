CREATE POLICY "Employees can update assigned services"
ON public.services FOR UPDATE
TO authenticated
USING (
  assigned_to = auth.uid()
  AND is_employee(auth.uid())
)
WITH CHECK (
  assigned_to = auth.uid()
  AND is_employee(auth.uid())
);