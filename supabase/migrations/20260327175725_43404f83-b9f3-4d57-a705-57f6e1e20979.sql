-- Phase 3 Analytics Migration

-- 1. Unified Analytics Events View
CREATE OR REPLACE VIEW public.view_analytics_unified_events AS
SELECT 
    id,
    user_id,
    organization_id,
    event_type,
    created_at,
    metadata
FROM public.user_activity_events
UNION ALL
SELECT 
    id,
    NULL as user_id,
    organization_id,
    event_type,
    created_at,
    metadata
FROM public.billing_events;

-- 2. Enhanced Funnel View
CREATE OR REPLACE VIEW public.view_analytics_funnel_advanced AS
WITH first_events AS (
    SELECT 
        u.id as user_id,
        u.organization_id,
        u.created_at as signup_at,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'signup_started') as step_1_signup_started,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'signup_completed') as step_2_signup_completed,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'login') as step_3_first_login,
        MIN(e.created_at) FILTER (WHERE e.event_type = ANY(ARRAY['service_created', 'agenda_viewed', 'client_created'])) as step_4_first_action,
        -- Ativação Real
        MIN(e.created_at) FILTER (WHERE e.event_type = 'service_created') as step_5_activation,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'subscription_created') as step_6_subscription_started,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'subscription_completed' OR (e.event_type = 'subscription_created' AND e.metadata->>'status' = 'active')) as step_7_subscription_completed
    FROM public.profiles u
    LEFT JOIN public.view_analytics_unified_events e ON e.user_id = u.id OR e.organization_id = u.organization_id
    GROUP BY u.id, u.organization_id, u.created_at
)
SELECT 
    COUNT(*) as total_users,
    COUNT(step_1_signup_started) as signup_started,
    COUNT(step_2_signup_completed) as signup_completed,
    COUNT(step_3_first_login) as first_login,
    COUNT(step_4_first_action) as first_action,
    COUNT(step_5_activation) as activated,
    COUNT(step_6_subscription_started) as subscription_started,
    COUNT(step_7_subscription_completed) as subscription_completed
FROM first_events;

-- 3. User Engagement and Scoring
CREATE OR REPLACE VIEW public.view_analytics_user_scores AS
WITH user_activity AS (
    SELECT 
        p.id as user_id,
        p.organization_id,
        p.full_name,
        COUNT(e.id) as total_events_30d,
        MAX(e.created_at) as last_active_at,
        MIN(p.created_at) as joined_at,
        COUNT(DISTINCT DATE_TRUNC('day', e.created_at)) as active_days_30d
    FROM public.profiles p
    LEFT JOIN public.view_analytics_unified_events e ON (e.user_id = p.id OR e.organization_id = p.organization_id)
        AND e.created_at > NOW() - INTERVAL '30 days'
    GROUP BY p.id, p.organization_id, p.full_name
)
SELECT 
    *,
    CASE 
        WHEN active_days_30d >= 15 THEN 'engajado'
        WHEN active_days_30d BETWEEN 5 AND 14 THEN 'potencial'
        WHEN active_days_30d BETWEEN 1 AND 4 THEN 'em risco'
        ELSE 'inativo'
    END as classification,
    CASE
        WHEN last_active_at < NOW() - INTERVAL '7 days' AND active_days_30d > 0 THEN true
        ELSE false
    END as is_churn_risk
FROM user_activity;

-- 4. Retention Cohorts
CREATE OR REPLACE VIEW public.view_analytics_retention_cohorts AS
WITH user_cohorts AS (
    SELECT 
        id as user_id,
        DATE_TRUNC('month', created_at) as cohort_month
    FROM public.profiles
),
user_activities AS (
    SELECT 
        user_id,
        DATE_TRUNC('month', started_at) as activity_month
    FROM public.user_sessions
    GROUP BY user_id, activity_month
)
SELECT 
    c.cohort_month,
    a.activity_month,
    COUNT(DISTINCT c.user_id) as active_users,
    EXTRACT(MONTH FROM AGE(a.activity_month, c.cohort_month)) as month_number
FROM user_cohorts c
JOIN user_activities a ON c.user_id = a.user_id
GROUP BY 1, 2
ORDER BY 1, 2;

-- 5. Analytics Alerts Table
CREATE TABLE IF NOT EXISTS public.analytics_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL,
    severity TEXT DEFAULT 'medium',
    message TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id),
    user_id UUID REFERENCES public.profiles(id),
    metadata JSONB,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.analytics_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can see all alerts"
ON public.analytics_alerts
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'
));

-- 6. Helper function to check anomalies
CREATE OR REPLACE FUNCTION public.check_analytics_anomalies()
RETURNS void AS $$
BEGIN
    -- Alert: Signup abandonment
    INSERT INTO public.analytics_alerts (alert_type, severity, message, metadata)
    SELECT 
        'signup_abandonment',
        'low',
        'Usuário iniciou cadastro mas não concluiu.',
        jsonb_build_object('user_id', user_id)
    FROM user_activity_events
    WHERE event_type = 'signup_started'
    AND created_at < NOW() - INTERVAL '30 minutes'
    AND user_id NOT IN (
        SELECT user_id FROM user_activity_events WHERE event_type = 'signup_completed'
    )
    AND NOT EXISTS (
        SELECT 1 FROM analytics_alerts 
        WHERE alert_type = 'signup_abandonment' 
        AND (metadata->>'user_id')::uuid = user_id
        AND created_at > NOW() - INTERVAL '24 hours'
    )
    LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. View for Activation Metrics
CREATE OR REPLACE VIEW public.view_analytics_activation_metrics AS
WITH user_activation AS (
    SELECT 
        p.id as user_id,
        p.created_at as joined_at,
        MIN(e.created_at) as activated_at,
        EXTRACT(EPOCH FROM (MIN(e.created_at) - p.created_at))/3600 as hours_to_activation
    FROM public.profiles p
    JOIN public.user_activity_events e ON e.user_id = p.id
    WHERE e.event_type = ANY(ARRAY['service_created', 'agenda_viewed'])
    GROUP BY p.id, p.created_at
)
SELECT 
    AVG(hours_to_activation) as avg_hours_to_activation,
    COUNT(DISTINCT user_id) FILTER (WHERE hours_to_activation <= 24) as activated_24h,
    COUNT(DISTINCT user_id) as total_activated,
    (SELECT COUNT(*) FROM public.profiles) as total_users
FROM user_activation;
