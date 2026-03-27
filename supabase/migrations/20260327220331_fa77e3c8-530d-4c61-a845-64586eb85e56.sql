
-- 1. Create blacklist table for internal anonymous_ids
CREATE TABLE IF NOT EXISTS public.analytics_internal_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id text NOT NULL UNIQUE,
  reason text DEFAULT 'internal_user',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.analytics_internal_ids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage internal ids"
  ON public.analytics_internal_ids
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 2. Auto-populate blacklist with anonymous_ids linked to authenticated users
INSERT INTO public.analytics_internal_ids (anonymous_id, reason)
SELECT DISTINCT metadata->>'anonymous_id', 'linked_to_authenticated_user'
FROM public.user_activity_events
WHERE user_id IS NOT NULL
  AND metadata->>'anonymous_id' IS NOT NULL
ON CONFLICT (anonymous_id) DO NOTHING;

-- 3. Add ip_address column to user_activity_events for future use
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_activity_events' AND column_name = 'ip_address' AND table_schema = 'public'
  ) THEN
    ALTER TABLE public.user_activity_events ADD COLUMN ip_address text;
  END IF;
END $$;

-- 4. Rewrite view_lead_journeys_summary with strict filters
DROP VIEW IF EXISTS public.view_lead_journeys_summary;

CREATE VIEW public.view_lead_journeys_summary AS
WITH 
authenticated_anon_ids AS (
  SELECT DISTINCT metadata->>'anonymous_id' AS anonymous_id
  FROM public.user_activity_events
  WHERE user_id IS NOT NULL
    AND metadata->>'anonymous_id' IS NOT NULL
),
blacklisted_ids AS (
  SELECT anonymous_id FROM public.analytics_internal_ids
  UNION
  SELECT anonymous_id FROM authenticated_anon_ids
),
marketing_events AS (
  SELECT
    e.metadata->>'anonymous_id' AS visitor_id,
    e.event_type,
    e.created_at,
    e.metadata
  FROM public.user_activity_events e
  WHERE e.user_id IS NULL
    AND (e.metadata->>'anonymous_id') IS NOT NULL
    AND (e.metadata->>'anonymous_id') NOT IN (SELECT anonymous_id FROM blacklisted_ids)
    AND e.event_type IN (
      'page_view', 'landing_page_view', 'interaction',
      'create_account_click', 'signup_started', 'signup_completed',
      'payment_initiated', 'payment_completed'
    )
    AND (
      (e.metadata->>'page_path') IS NULL
      OR (
        (e.metadata->>'page_path') NOT LIKE '/dashboard%'
        AND (e.metadata->>'page_path') NOT LIKE '/agenda%'
        AND (e.metadata->>'page_path') NOT LIKE '/financeiro%'
        AND (e.metadata->>'page_path') NOT LIKE '/clientes%'
        AND (e.metadata->>'page_path') NOT LIKE '/servicos%'
        AND (e.metadata->>'page_path') NOT LIKE '/settings%'
        AND (e.metadata->>'page_path') NOT LIKE '/admin%'
        AND (e.metadata->>'page_path') NOT LIKE '/whatsapp%'
        AND (e.metadata->>'page_path') NOT LIKE '/equipe%'
        AND (e.metadata->>'page_path') NOT LIKE '/relatorios%'
        AND (e.metadata->>'page_path') NOT LIKE '/catalogo%'
      )
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
    min(le.created_at) AS first_seen,
    max(le.created_at) AS last_seen,
    count(*) AS total_events,
    count(DISTINCT le.metadata->>'page_path') AS unique_pages,
    bool_or(le.event_type = 'create_account_click') AS clicked_cta,
    bool_or(le.event_type IN ('interaction', 'create_account_click', 'signup_started')) AS has_interaction,
    EXTRACT(epoch FROM (max(le.created_at) - min(le.created_at)))::integer AS total_duration_seconds,
    (array_agg(le.metadata->>'utm_source' ORDER BY le.created_at) FILTER (WHERE (le.metadata->>'utm_source') IS NOT NULL))[1] AS source,
    (array_agg(le.metadata->>'utm_medium' ORDER BY le.created_at) FILTER (WHERE (le.metadata->>'utm_medium') IS NOT NULL))[1] AS medium,
    (array_agg(le.metadata->>'utm_campaign' ORDER BY le.created_at) FILTER (WHERE (le.metadata->>'utm_campaign') IS NOT NULL))[1] AS campaign,
    (array_agg(le.metadata->>'page_path' ORDER BY le.created_at DESC))[1] AS last_page
  FROM marketing_events le
  WHERE le.visitor_id NOT IN (SELECT visitor_id FROM conversions)
  GROUP BY le.visitor_id
)
SELECT
  visitor_id,
  first_seen,
  last_seen,
  total_events,
  unique_pages,
  clicked_cta,
  total_duration_seconds,
  source,
  medium,
  campaign,
  last_page
FROM lead_summaries
WHERE 
  (total_events >= 2 OR total_duration_seconds > 5 OR has_interaction = true)
  AND NOT (total_events = 1 AND total_duration_seconds < 2);

-- 5. Update get_lead_journey_timeline to exclude blacklisted ids
CREATE OR REPLACE FUNCTION public.get_lead_journey_timeline(p_visitor_id text)
RETURNS TABLE(
  event_type text,
  created_at timestamptz,
  page_path text,
  page_title text,
  duration_on_page integer,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.analytics_internal_ids WHERE anonymous_id = p_visitor_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_activity_events 
    WHERE user_id IS NOT NULL AND metadata->>'anonymous_id' = p_visitor_id
    LIMIT 1
  ) THEN
    RETURN;
  END IF;

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
      (e.metadata->>'page_path') IS NULL
      OR (
        (e.metadata->>'page_path') NOT LIKE '/dashboard%'
        AND (e.metadata->>'page_path') NOT LIKE '/agenda%'
        AND (e.metadata->>'page_path') NOT LIKE '/financeiro%'
        AND (e.metadata->>'page_path') NOT LIKE '/clientes%'
        AND (e.metadata->>'page_path') NOT LIKE '/servicos%'
        AND (e.metadata->>'page_path') NOT LIKE '/settings%'
        AND (e.metadata->>'page_path') NOT LIKE '/admin%'
        AND (e.metadata->>'page_path') NOT LIKE '/whatsapp%'
        AND (e.metadata->>'page_path') NOT LIKE '/equipe%'
        AND (e.metadata->>'page_path') NOT LIKE '/relatorios%'
        AND (e.metadata->>'page_path') NOT LIKE '/catalogo%'
      )
    )
  ORDER BY e.created_at ASC;
END;
$function$;
