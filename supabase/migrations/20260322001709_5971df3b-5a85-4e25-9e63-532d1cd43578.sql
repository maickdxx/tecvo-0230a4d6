-- Fix: recreate view as SECURITY INVOKER (default in newer PG, but explicit is safer)
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe
WITH (security_invoker = true)
AS
SELECT
  id,
  user_id,
  organization_id,
  full_name,
  avatar_url,
  position,
  employee_type,
  field_worker,
  phone,
  created_at,
  updated_at,
  last_access,
  whatsapp_signature_enabled,
  notification_preferences,
  dashboard_layout,
  demo_tour_completed,
  ai_assistant_name,
  ai_assistant_voice,
  whatsapp_personal
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;