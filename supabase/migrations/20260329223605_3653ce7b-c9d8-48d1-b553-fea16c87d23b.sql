-- Update policy "Users can update their own profile" to protect more columns
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO public 
USING (auth.uid() = user_id) 
WITH CHECK (
  auth.uid() = user_id AND 
  (
    -- If user is owner, they can update everything in their own profile
    has_role(auth.uid(), 'owner'::app_role) 
    OR 
    -- If not owner, ensure restricted columns are NOT changed
    NOT (
      (
        SELECT ROW(
          p.hourly_rate, p.cpf, p.rg, p.hire_date, p.employee_type, 
          p.address_cep, p.address_street, p.address_number, p.address_neighborhood, 
          p.address_city, p.address_state, p.notes, p."position", 
          p.field_worker, p.organization_id, p.user_id, 
          p.whatsapp_ai_enabled, p.ai_assistant_name, p.ai_assistant_voice,
          p.whatsapp_signature, p.notification_preferences, p.dashboard_layout
        ) FROM profiles p WHERE p.id = profiles.id
      ) IS DISTINCT FROM ROW(
        hourly_rate, cpf, rg, hire_date, employee_type, 
        address_cep, address_street, address_number, address_neighborhood, 
        address_city, address_state, notes, "position", 
        field_worker, organization_id, user_id, 
        whatsapp_ai_enabled, ai_assistant_name, ai_assistant_voice,
        whatsapp_signature, notification_preferences, dashboard_layout
      )
    )
  )
);

-- Update policy for Admins to also restrict whatsapp_signature, etc.
DROP POLICY IF EXISTS "Admins can update profiles in their organization" ON public.profiles;

CREATE POLICY "Admins can update profiles in their organization"
ON public.profiles
FOR UPDATE
TO public
USING (organization_id = get_user_organization_id() AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (
  -- Admins can't change AI settings, signature, notifications, or layout of any profile (including their own via this policy)
  NOT (
    (
      SELECT ROW(
        p.whatsapp_ai_enabled, p.ai_assistant_name, p.ai_assistant_voice,
        p.whatsapp_signature, p.notification_preferences, p.dashboard_layout
      ) FROM profiles p WHERE p.id = profiles.id
    ) IS DISTINCT FROM ROW(
      whatsapp_ai_enabled, ai_assistant_name, ai_assistant_voice,
      whatsapp_signature, notification_preferences, dashboard_layout
    )
  )
);
