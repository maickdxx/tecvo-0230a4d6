-- Create A/B Testing tables
CREATE TABLE public.ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    traffic_percentage INTEGER DEFAULT 100,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
    end_date TIMESTAMP WITH TIME ZONE,
    winner_variant_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    is_control BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.ab_test_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES public.ab_tests(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.ab_test_variants(id) ON DELETE CASCADE,
    user_id UUID,
    anonymous_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(test_id, user_id),
    UNIQUE(test_id, anonymous_id)
);

-- Add RLS
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_assignments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read for ab_tests" ON public.ab_tests FOR SELECT USING (true);
CREATE POLICY "Public read for ab_test_variants" ON public.ab_test_variants FOR SELECT USING (true);
CREATE POLICY "Insert for assignments" ON public.ab_test_assignments FOR INSERT WITH CHECK (true);
CREATE POLICY "Read assignments" ON public.ab_test_assignments FOR SELECT USING (true);

-- Admin policies
CREATE POLICY "Admin full access ab_tests" ON public.ab_tests 
FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'));

CREATE POLICY "Admin full access ab_test_variants" ON public.ab_test_variants 
FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'));

CREATE POLICY "Admin full access ab_test_assignments" ON public.ab_test_assignments 
FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'super_admin'));

-- Views for Analytics
CREATE OR REPLACE VIEW public.view_analytics_ab_test_results AS
SELECT 
    t.id as test_id,
    t.name as test_name,
    v.id as variant_id,
    v.name as variant_name,
    COUNT(DISTINCT a.id) as total_users,
    COUNT(DISTINCT CASE WHEN e.event_type = 'signup_completed' THEN a.id END) as total_conversions,
    ROUND(
        (COUNT(DISTINCT CASE WHEN e.event_type = 'signup_completed' THEN a.id END)::numeric / 
        NULLIF(COUNT(DISTINCT a.id), 0)::numeric) * 100, 
        2
    ) as conversion_rate
FROM public.ab_tests t
JOIN public.ab_test_variants v ON v.test_id = t.id
LEFT JOIN public.ab_test_assignments a ON a.variant_id = v.id
LEFT JOIN public.user_activity_events e ON (
    (e.user_id = a.user_id OR e.metadata->>'anonymous_id' = a.anonymous_id)
    AND e.created_at >= a.created_at
)
GROUP BY t.id, t.name, v.id, v.name;
