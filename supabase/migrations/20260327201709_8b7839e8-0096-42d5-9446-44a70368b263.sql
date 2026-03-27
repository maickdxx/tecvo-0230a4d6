-- Drop and recreate the view to change column names/types
DROP VIEW IF EXISTS public.view_lead_journeys_summary;

CREATE VIEW public.view_lead_journeys_summary AS
WITH lead_events AS (
  SELECT 
    COALESCE(metadata->>'anonymous_id', user_id::text) as visitor_id,
    event_type,
    created_at,
    metadata
  FROM user_activity_events
),
conversions AS (
  SELECT DISTINCT visitor_id
  FROM lead_events
  WHERE event_type IN ('signup_completed', 'payment_completed')
),
lead_summaries AS (
  SELECT 
    le.visitor_id,
    MIN(le.created_at) as first_seen,
    MAX(le.created_at) as last_seen,
    COUNT(*) as total_events,
    COUNT(DISTINCT le.metadata->>'page_path') as unique_pages,
    bool_or(le.event_type = 'create_account_click') as clicked_cta,
    EXTRACT(EPOCH FROM (MAX(le.created_at) - MIN(le.created_at)))::INTEGER as total_duration_seconds,
    le.metadata->>'utm_source' as source,
    le.metadata->>'utm_medium' as medium,
    le.metadata->>'utm_campaign' as campaign,
    (
      SELECT le2.metadata->>'page_path'
      FROM lead_events le2
      WHERE le2.visitor_id = le.visitor_id
      ORDER BY le2.created_at DESC
      LIMIT 1
    ) as last_page
  FROM lead_events le
  WHERE le.visitor_id NOT IN (SELECT visitor_id FROM conversions)
  AND le.visitor_id IS NOT NULL
  GROUP BY le.visitor_id, le.metadata->>'utm_source', le.metadata->>'utm_medium', le.metadata->>'utm_campaign'
)
SELECT * FROM lead_summaries;

-- Re-grant permissions
GRANT SELECT ON public.view_lead_journeys_summary TO authenticated;
GRANT SELECT ON public.view_lead_journeys_summary TO service_role;
