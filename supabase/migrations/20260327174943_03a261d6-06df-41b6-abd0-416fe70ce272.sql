-- Create a specific funnel view
CREATE OR REPLACE VIEW public.view_analytics_funnel AS
WITH funnel_steps AS (
    SELECT 
        user_id,
        id as session_id,
        MIN(created_at) FILTER (WHERE event_type = 'page_view' AND metadata->>'page_path' = '/') as step_1_landing,
        MIN(created_at) FILTER (WHERE event_type = 'signup_started') as step_2_signup_started,
        MIN(created_at) FILTER (WHERE event_type = 'signup_completed') as step_3_signup_completed,
        MIN(created_at) FILTER (WHERE event_type = 'login') as step_4_first_login,
        MIN(created_at) FILTER (WHERE event_type IN ('service_created', 'agenda_viewed')) as step_5_first_action
    FROM public.view_analytics_events
    GROUP BY 1, 2
)
SELECT
    COUNT(*) as total_entries,
    COUNT(step_1_landing) as landing_page,
    COUNT(step_2_signup_started) as signup_started,
    COUNT(step_3_signup_completed) as signup_completed,
    COUNT(step_4_first_login) as first_login,
    COUNT(step_5_first_action) as first_action
FROM funnel_steps;