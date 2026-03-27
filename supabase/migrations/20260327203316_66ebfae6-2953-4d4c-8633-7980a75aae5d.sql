
-- =====================================================
-- FIX: Eliminate data contamination in lead analytics
-- Only anonymous visitors on public pages are leads
-- =====================================================

-- 1. Recreate view_lead_journeys_summary (clean leads only)
DROP VIEW IF EXISTS public.view_lead_journeys_summary;

CREATE VIEW public.view_lead_journeys_summary AS
WITH marketing_events AS (
  SELECT
    metadata->>'anonymous_id' as visitor_id,
    event_type,
    created_at,
    metadata
  FROM user_activity_events
  WHERE user_id IS NULL
    AND metadata->>'anonymous_id' IS NOT NULL
    AND event_type IN (
      'page_view', 'landing_page_view', 'interaction',
      'create_account_click', 'signup_started', 'signup_completed',
      'payment_initiated', 'payment_completed'
    )
    AND (
      metadata->>'page_path' IS NULL
      OR metadata->>'page_path' NOT LIKE '/dashboard%'
      AND metadata->>'page_path' NOT LIKE '/agenda%'
      AND metadata->>'page_path' NOT LIKE '/financeiro%'
      AND metadata->>'page_path' NOT LIKE '/clientes%'
      AND metadata->>'page_path' NOT LIKE '/servicos%'
      AND metadata->>'page_path' NOT LIKE '/settings%'
      AND metadata->>'page_path' NOT LIKE '/admin%'
      AND metadata->>'page_path' NOT LIKE '/whatsapp%'
      AND metadata->>'page_path' NOT LIKE '/equipe%'
      AND metadata->>'page_path' NOT LIKE '/relatorios%'
      AND metadata->>'page_path' NOT LIKE '/catalogo%'
    )
),
conversions AS (
  SELECT DISTINCT visitor_id
  FROM marketing_events
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
    (array_agg(le.metadata->>'utm_source' ORDER BY le.created_at ASC) FILTER (WHERE le.metadata->>'utm_source' IS NOT NULL))[1] as source,
    (array_agg(le.metadata->>'utm_medium' ORDER BY le.created_at ASC) FILTER (WHERE le.metadata->>'utm_medium' IS NOT NULL))[1] as medium,
    (array_agg(le.metadata->>'utm_campaign' ORDER BY le.created_at ASC) FILTER (WHERE le.metadata->>'utm_campaign' IS NOT NULL))[1] as campaign,
    (array_agg(le.metadata->>'page_path' ORDER BY le.created_at DESC))[1] as last_page
  FROM marketing_events le
  WHERE le.visitor_id NOT IN (SELECT visitor_id FROM conversions)
  GROUP BY le.visitor_id
)
SELECT * FROM lead_summaries;

GRANT SELECT ON public.view_lead_journeys_summary TO authenticated;
GRANT SELECT ON public.view_lead_journeys_summary TO service_role;

-- 2. Recreate get_lead_journey_timeline function (same filters)
CREATE OR REPLACE FUNCTION public.get_lead_journey_timeline(p_visitor_id TEXT)
RETURNS TABLE (
  event_type TEXT,
  created_at TIMESTAMPTZ,
  page_path TEXT,
  page_title TEXT,
  duration_on_page INTEGER,
  metadata JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.event_type,
    e.created_at,
    e.metadata->>'page_path' as page_path,
    e.metadata->>'page_title' as page_title,
    (e.metadata->>'duration_on_previous_page')::INTEGER as duration_on_page,
    e.metadata
  FROM user_activity_events e
  WHERE e.metadata->>'anonymous_id' = p_visitor_id
    AND e.user_id IS NULL
    AND e.event_type IN (
      'page_view', 'landing_page_view', 'interaction',
      'create_account_click', 'signup_started', 'signup_completed',
      'payment_initiated', 'payment_completed'
    )
    AND (
      e.metadata->>'page_path' IS NULL
      OR e.metadata->>'page_path' NOT LIKE '/dashboard%'
      AND e.metadata->>'page_path' NOT LIKE '/agenda%'
      AND e.metadata->>'page_path' NOT LIKE '/financeiro%'
      AND e.metadata->>'page_path' NOT LIKE '/clientes%'
      AND e.metadata->>'page_path' NOT LIKE '/servicos%'
      AND e.metadata->>'page_path' NOT LIKE '/settings%'
      AND e.metadata->>'page_path' NOT LIKE '/admin%'
      AND e.metadata->>'page_path' NOT LIKE '/whatsapp%'
      AND e.metadata->>'page_path' NOT LIKE '/equipe%'
      AND e.metadata->>'page_path' NOT LIKE '/relatorios%'
      AND e.metadata->>'page_path' NOT LIKE '/catalogo%'
    )
  ORDER BY e.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lead_journey_timeline(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_journey_timeline(TEXT) TO service_role;
