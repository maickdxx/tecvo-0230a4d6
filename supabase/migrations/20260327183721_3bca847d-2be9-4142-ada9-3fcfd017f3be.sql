-- Create table for winning patterns identified in A/B tests
CREATE TABLE public.ab_test_winning_patterns (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    pattern_type TEXT NOT NULL CHECK (pattern_type IN ('headline', 'cta', 'structure', 'element', 'color_scheme')),
    name TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL,
    performance_lift DECIMAL(5,2),
    conversion_rate DECIMAL(5,2),
    source_test_id UUID REFERENCES public.ab_tests(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for high-conversion templates
CREATE TABLE public.ab_test_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN ('landing_page', 'email', 'checkout', 'onboarding')),
    structure JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create a view for campaign comparison (enriched)
CREATE OR REPLACE VIEW public.view_campaign_comparison AS
WITH campaign_events AS (
    SELECT 
        utm_source,
        utm_medium,
        utm_campaign,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'signup_completed') as signups,
        COUNT(DISTINCT user_id) FILTER (WHERE event_type = 'payment_completed') as conversions
    FROM 
        public.view_analytics_events
    GROUP BY 
        utm_source, utm_medium, utm_campaign
)
SELECT 
    ts.campaign,
    ts.source,
    ts.medium,
    ts.session_count,
    COALESCE(ce.signups, 0) as signups,
    COALESCE(ce.conversions, 0) as conversions,
    CASE 
        WHEN ts.session_count > 0 THEN 
            ROUND((COALESCE(ce.conversions, 0)::DECIMAL / ts.session_count) * 100, 2)
        ELSE 0 
    END as conversion_rate
FROM 
    public.view_analytics_traffic_sources ts
LEFT JOIN 
    campaign_events ce ON 
        COALESCE(ce.utm_campaign, '') = COALESCE(ts.campaign, '') AND 
        COALESCE(ce.utm_source, '') = COALESCE(ts.source, '') AND 
        COALESCE(ce.utm_medium, '') = COALESCE(ts.medium, '');

-- Enable RLS
ALTER TABLE public.ab_test_winning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_templates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow authenticated users to read winning patterns" 
ON public.ab_test_winning_patterns FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage winning patterns" 
ON public.ab_test_winning_patterns FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to read templates" 
ON public.ab_test_templates FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admins to manage templates" 
ON public.ab_test_templates FOR ALL USING (auth.role() = 'authenticated');

-- Trigger for updated_at (Assuming the function already exists based on earlier view)
CREATE TRIGGER update_ab_test_winning_patterns_updated_at
BEFORE UPDATE ON public.ab_test_winning_patterns
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ab_test_templates_updated_at
BEFORE UPDATE ON public.ab_test_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
