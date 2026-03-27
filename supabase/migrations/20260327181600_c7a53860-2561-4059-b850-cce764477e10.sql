-- View for Lead Funnel (Marketing Focus)
CREATE OR REPLACE VIEW view_analytics_marketing_funnel AS
WITH marketing_events AS (
  SELECT 
    COALESCE(user_id::text, metadata->>'session_id', id::text) as visitor_id,
    event_type,
    created_at,
    metadata->>'page_path' as page_path
  FROM user_activity_events
),
funnel_steps AS (
  SELECT
    visitor_id,
    MIN(created_at) FILTER (WHERE event_type IN ('page_view', 'landing_page_view')) as step_1_visit,
    MIN(created_at) FILTER (WHERE event_type = 'interaction') as step_2_interaction,
    MIN(created_at) FILTER (WHERE event_type = 'create_account_click') as step_3_cta_click,
    MIN(created_at) FILTER (WHERE event_type = 'signup_started') as step_4_signup_started,
    MIN(created_at) FILTER (WHERE event_type = 'signup_completed') as step_5_signup_completed,
    MIN(created_at) FILTER (WHERE event_type = 'payment_initiated') as step_6_payment_initiated,
    MIN(created_at) FILTER (WHERE event_type = 'payment_completed') as step_7_payment_completed
  FROM marketing_events
  GROUP BY visitor_id
)
SELECT
  COUNT(DISTINCT visitor_id) as total_visitors,
  COUNT(step_1_visit) as landing_page_views,
  COUNT(step_2_interaction) as interactions,
  COUNT(step_3_cta_click) as cta_clicks,
  COUNT(step_4_signup_started) as signups_started,
  COUNT(step_5_signup_completed) as signups_completed,
  COUNT(step_6_payment_initiated) as payments_initiated,
  COUNT(step_7_payment_completed) as payments_completed,
  -- Conversion Rates
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_3_cta_click)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as cta_click_rate,
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_4_signup_started)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as signup_start_rate,
  CASE WHEN COUNT(step_4_signup_started) > 0 THEN (COUNT(step_5_signup_completed)::float / COUNT(step_4_signup_started)) * 100 ELSE 0 END as signup_completion_rate,
  CASE WHEN COUNT(step_1_visit) > 0 THEN (COUNT(step_7_payment_completed)::float / COUNT(step_1_visit)) * 100 ELSE 0 END as final_conversion_rate,
  -- Average Time to Conversion (Landing to Signup Completed)
  AVG(EXTRACT(EPOCH FROM (step_5_signup_completed - step_1_visit))) FILTER (WHERE step_5_signup_completed IS NOT NULL) as avg_time_to_signup_seconds
FROM funnel_steps;

-- View for Lead Journey Drop-offs
CREATE OR REPLACE VIEW view_analytics_lead_dropoffs AS
WITH visitor_last_page AS (
  SELECT 
    COALESCE(e.user_id::text, e.metadata->>'session_id', e.id::text) as visitor_id,
    e.metadata->>'page_path' as last_page,
    e.created_at as last_at,
    ROW_NUMBER() OVER(PARTITION BY COALESCE(e.user_id::text, e.metadata->>'session_id', e.id::text) ORDER BY e.created_at DESC) as rank
  FROM user_activity_events e
  WHERE e.event_type IN ('page_view', 'landing_page_view')
),
converted_visitors AS (
  SELECT DISTINCT COALESCE(user_id::text, metadata->>'session_id', id::text) as visitor_id
  FROM user_activity_events
  WHERE event_type = 'payment_completed' OR event_type = 'signup_completed'
)
SELECT 
  last_page,
  COUNT(*) as dropoff_count
FROM visitor_last_page v
WHERE rank = 1
AND visitor_id NOT IN (SELECT visitor_id FROM converted_visitors)
GROUP BY last_page
ORDER BY dropoff_count DESC;

-- View for CTA Performance
CREATE OR REPLACE VIEW view_analytics_cta_performance AS
SELECT 
  metadata->>'location' as cta_location,
  metadata->>'plan' as cta_plan,
  COUNT(*) as click_count
FROM user_activity_events
WHERE event_type = 'create_account_click'
GROUP BY cta_location, cta_plan
ORDER BY click_count DESC;

-- View for Lead Path analysis
CREATE OR REPLACE VIEW view_analytics_lead_paths AS
SELECT 
  visitor_id,
  string_agg(event_type, ' -> ' ORDER BY created_at) as path,
  COUNT(*) as interaction_count,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as total_time_seconds
FROM (
  SELECT 
    COALESCE(user_id::text, metadata->>'session_id', id::text) as visitor_id,
    event_type,
    created_at
  FROM user_activity_events
  -- Limit to first 10 events per visitor for readability
  WHERE event_type != 'interaction' 
) sub
GROUP BY visitor_id
LIMIT 100;
