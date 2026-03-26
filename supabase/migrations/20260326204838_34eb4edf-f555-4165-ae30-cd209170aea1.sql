
-- Fix remaining search_path warnings
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path TO 'public';
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path TO 'public';
ALTER FUNCTION public.delete_email(text, bigint) SET search_path TO 'public';

-- Fix Security Definer View warning on profiles_safe - make it SECURITY INVOKER
DROP VIEW IF EXISTS public.profiles_safe;
CREATE VIEW public.profiles_safe WITH (security_invoker = true) AS
SELECT 
  id, user_id, organization_id, full_name, avatar_url,
  "position", employee_type, field_worker, phone,
  created_at, updated_at, last_access,
  whatsapp_signature_enabled, notification_preferences,
  dashboard_layout, demo_tour_completed,
  ai_assistant_name, ai_assistant_voice, whatsapp_personal
FROM public.profiles;

GRANT SELECT ON public.profiles_safe TO authenticated;

-- Also make whatsapp_channels_safe use security_invoker
DROP VIEW IF EXISTS public.whatsapp_channels_safe;
CREATE VIEW public.whatsapp_channels_safe WITH (security_invoker = true) AS
SELECT 
  id, organization_id, name, color, phone_number, is_connected,
  last_connected_at, created_at, updated_at, instance_name, owner_jid,
  disconnected_reason, waba_id, phone_number_id, integration_type,
  channel_type, channel_status
FROM public.whatsapp_channels;

GRANT SELECT ON public.whatsapp_channels_safe TO authenticated;
