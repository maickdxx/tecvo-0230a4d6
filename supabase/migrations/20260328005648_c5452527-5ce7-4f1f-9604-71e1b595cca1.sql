
-- ============================================================
-- Restrict A/B test table policies
-- ============================================================

-- 1. ab_test_hypotheses: super_admin only (strategic data)
DROP POLICY IF EXISTS "Admins can manage hypotheses" ON public.ab_test_hypotheses;
CREATE POLICY "Super admin manages hypotheses" ON public.ab_test_hypotheses
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 2. ab_test_pattern_applications: super_admin only
DROP POLICY IF EXISTS "Admins can manage pattern applications" ON public.ab_test_pattern_applications;
CREATE POLICY "Super admin manages pattern applications" ON public.ab_test_pattern_applications
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 3. ab_test_templates: super_admin only
DROP POLICY IF EXISTS "Allow admins to manage templates" ON public.ab_test_templates;
DROP POLICY IF EXISTS "Allow authenticated users to read templates" ON public.ab_test_templates;
CREATE POLICY "Super admin manages templates" ON public.ab_test_templates
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. ab_test_winning_patterns: super_admin only
DROP POLICY IF EXISTS "Allow admins to manage winning patterns" ON public.ab_test_winning_patterns;
DROP POLICY IF EXISTS "Allow authenticated users to read winning patterns" ON public.ab_test_winning_patterns;
CREATE POLICY "Super admin manages winning patterns" ON public.ab_test_winning_patterns
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 5. ab_tests: keep super_admin full + public read for active tests only (needed by useABTest)
DROP POLICY IF EXISTS "Public read for ab_tests" ON public.ab_tests;
CREATE POLICY "Read active tests" ON public.ab_tests
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 6. ab_test_variants: keep super_admin full + read only for active test variants
DROP POLICY IF EXISTS "Public read for ab_test_variants" ON public.ab_test_variants;
CREATE POLICY "Read variants of active tests" ON public.ab_test_variants
  FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ab_tests t
    WHERE t.id = ab_test_variants.test_id AND t.is_active = true
  ));

-- 7. ab_test_assignments: keep super_admin full + anon insert (for landing page tracking)
DROP POLICY IF EXISTS "Read assignments" ON public.ab_test_assignments;
DROP POLICY IF EXISTS "Insert for assignments" ON public.ab_test_assignments;
CREATE POLICY "Insert assignments" ON public.ab_test_assignments
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Super admin reads assignments" ON public.ab_test_assignments
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));
