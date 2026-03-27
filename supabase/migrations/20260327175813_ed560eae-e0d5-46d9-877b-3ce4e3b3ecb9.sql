DROP VIEW IF EXISTS public.view_analytics_funnel_advanced;

CREATE OR REPLACE VIEW public.view_analytics_funnel_advanced AS
WITH landing_visits AS (
    SELECT COUNT(DISTINCT COALESCE(user_id::text, id::text)) as count FROM public.user_sessions
),
first_events AS (
    SELECT 
        u.id as user_id,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'signup_started') as step_1_signup_started,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'signup_completed') as step_2_signup_completed,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'login') as step_3_first_login,
        MIN(e.created_at) FILTER (WHERE e.event_type = ANY(ARRAY['service_created', 'agenda_viewed', 'client_created'])) as step_4_first_action,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'service_created') as step_5_activation,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'subscription_created') as step_6_subscription_started,
        MIN(e.created_at) FILTER (WHERE e.event_type = 'subscription_completed' OR (e.event_type = 'subscription_created' AND e.metadata->>'status' = 'active')) as step_7_subscription_completed
    FROM public.profiles u
    LEFT JOIN public.view_analytics_unified_events e ON e.user_id = u.id OR e.organization_id = u.organization_id
    GROUP BY u.id
)
SELECT 
    (SELECT count FROM landing_visits) as landing_page,
    COUNT(step_1_signup_started) as signup_started,
    COUNT(step_2_signup_completed) as signup_completed,
    COUNT(step_3_first_login) as first_login,
    COUNT(step_4_first_action) as first_action,
    COUNT(step_5_activation) as activated,
    COUNT(step_6_subscription_started) as subscription_started,
    COUNT(step_7_subscription_completed) as subscription_completed
FROM first_events;
