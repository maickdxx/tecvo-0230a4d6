
-- ============================================================
-- Fix tables with RLS enabled but no policies
-- All 5 tables are backend-only (edge functions using service_role)
-- Policies: block anon/authenticated direct access, service_role bypasses RLS
-- ============================================================

-- 1. client_portal_sessions — managed by client-portal-auth edge function
CREATE POLICY "Service role only" ON public.client_portal_sessions
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 2. email_verifications — managed by verify-email edge function  
CREATE POLICY "Service role only" ON public.email_verifications
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 3. password_reset_codes — managed by password reset edge functions
CREATE POLICY "Service role only" ON public.password_reset_codes
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 4. stripe_webhook_events — managed by stripe webhook edge function
CREATE POLICY "Service role only" ON public.stripe_webhook_events
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- 5. whatsapp_chat_history — managed by WhatsApp edge functions
CREATE POLICY "Service role only" ON public.whatsapp_chat_history
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
