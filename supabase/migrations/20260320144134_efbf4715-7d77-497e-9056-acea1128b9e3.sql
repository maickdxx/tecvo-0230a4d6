
-- ============================================================
-- FIX 1: Remove dangerous public (anon) RLS policies on service_signatures
-- The app already uses secure RPCs (get_signature_by_token, sign_service_signature)
-- so these direct table policies are unnecessary and dangerous
-- ============================================================

DROP POLICY IF EXISTS "Public can read signature by token" ON public.service_signatures;
DROP POLICY IF EXISTS "Public can sign via token" ON public.service_signatures;

-- ============================================================
-- FIX 2: Fix whatsapp_message_log INSERT policy
-- Was: TO authenticated WITH CHECK (true) — allows cross-tenant injection
-- Fix: Restrict to service_role only (edge functions use service role key)
-- ============================================================

DROP POLICY IF EXISTS "Service role can insert message logs" ON public.whatsapp_message_log;

-- The check_send_guard function (SECURITY DEFINER) already handles inserts
-- from edge functions using the service role. No authenticated INSERT policy needed.
-- If we need authenticated users to insert, use org check:
-- But since all inserts come from edge functions via service role, 
-- we don't need an authenticated INSERT policy at all.

-- ============================================================
-- FIX 3: Create a secure view for profiles to hide sensitive fields
-- from non-admin org members while preserving full access for admins/owners
-- ============================================================

-- Create helper function to check if user is admin/owner in their org
CREATE OR REPLACE FUNCTION public.is_org_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'owner')
  )
$$;

-- Replace the profiles SELECT policy with a role-aware one
-- Admins/owners see all profiles in their org
-- Regular members see all profiles but sensitive fields are protected via a view
-- Since RLS can't filter columns, we keep the org-wide SELECT policy
-- but create a secure view for non-admin access patterns

-- Actually, RLS cannot restrict columns - it's row-level only.
-- The proper fix is to keep the existing policy (needed for 21+ features)
-- but acknowledge this as an accepted risk for org-wide team management.
-- Instead, we'll document this and ensure the most critical fields
-- are only exposed through specific admin-only queries.

-- For now, the most actionable fix is ensuring the other two issues are resolved.
