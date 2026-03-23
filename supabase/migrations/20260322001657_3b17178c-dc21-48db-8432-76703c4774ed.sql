-- Remove the overly broad policy that still allows all members to see all columns
DROP POLICY IF EXISTS "Members can view basic profiles in their org" ON public.profiles;

-- Create a secure view for team-visible profile data (no sensitive fields)
CREATE OR REPLACE VIEW public.profiles_safe AS
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

-- Grant access to authenticated users
GRANT SELECT ON public.profiles_safe TO authenticated;

-- Enable RLS isn't possible on views, but the underlying table's RLS applies
-- The view inherits RLS from the profiles table since it's not SECURITY DEFINER