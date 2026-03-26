
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1. RESTRICT PROFILES RLS: Replace the broad "Members can view profiles in their org" 
-- policy with one that only exposes safe columns via the existing profiles_safe view.
-- Drop the overly permissive member SELECT policy
DROP POLICY IF EXISTS "Members can view profiles in their org" ON public.profiles;

-- 2. CREATE SECURE VIEW FOR WHATSAPP CHANNELS (hide access_token)
CREATE OR REPLACE VIEW public.whatsapp_channels_safe AS
SELECT 
  id, organization_id, name, color, phone_number, is_connected,
  last_connected_at, created_at, updated_at, instance_name, owner_jid,
  disconnected_reason, waba_id, phone_number_id, integration_type,
  channel_type, channel_status
FROM public.whatsapp_channels;

-- Grant access to the view
GRANT SELECT ON public.whatsapp_channels_safe TO authenticated;

-- 3. HARDEN SQL FUNCTIONS - Add search_path to functions missing it
ALTER FUNCTION public.sync_service_duration() SET search_path TO 'public';
ALTER FUNCTION public.calculate_service_total_duration(uuid) SET search_path TO 'public';
ALTER FUNCTION public.validate_service_type() SET search_path TO 'public';
ALTER FUNCTION public.track_whatsapp_channel_transition() SET search_path TO 'public';

-- 4. Make whatsapp-media bucket private (currently public)
UPDATE storage.buckets SET public = false WHERE name = 'whatsapp-media' AND public = true;

-- 5. Make report-photos bucket private (currently public) 
UPDATE storage.buckets SET public = false WHERE name = 'report-photos' AND public = true;

-- 6. Make shared-pdfs bucket private (currently public)
UPDATE storage.buckets SET public = false WHERE name = 'shared-pdfs' AND public = true;

-- 7. Make avatars bucket private (currently public)  
UPDATE storage.buckets SET public = false WHERE name = 'avatars' AND public = true;

-- 8. Make service-signatures bucket private (currently public)
UPDATE storage.buckets SET public = false WHERE name = 'service-signatures' AND public = true;

-- 9. Make organization-logos bucket private (currently public)
UPDATE storage.buckets SET public = false WHERE name = 'organization-logos' AND public = true;
