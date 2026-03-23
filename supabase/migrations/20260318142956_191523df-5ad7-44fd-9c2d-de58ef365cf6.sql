
-- RPC for WhatsApp report: server-side aggregation eliminates loading all contacts+messages
CREATE OR REPLACE FUNCTION public.get_whatsapp_report_stats(
  _org_id uuid,
  _channel_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
  _today_start timestamptz;
  _yesterday_start timestamptz;
  _month_start timestamptz;
  _thirty_days_ago timestamptz;
BEGIN
  -- Validate org access
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND organization_id = _org_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  _today_start := date_trunc('day', now());
  _yesterday_start := _today_start - interval '1 day';
  _month_start := date_trunc('month', now());
  _thirty_days_ago := now() - interval '30 days';

  WITH filtered_contacts AS (
    SELECT id, channel_id, assigned_to, conversation_status, created_at,
           last_message_at, linked_service_id, needs_resolution, is_unread
    FROM public.whatsapp_contacts
    WHERE organization_id = _org_id
      AND is_group = false
      AND (_channel_id IS NULL OR channel_id = _channel_id)
  ),
  counts AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at >= _today_start)::int AS convs_today,
      COUNT(*) FILTER (WHERE created_at >= _yesterday_start AND created_at < _today_start)::int AS convs_yesterday,
      COUNT(*) FILTER (WHERE created_at >= _month_start)::int AS convs_month,
      COUNT(*) FILTER (WHERE conversation_status = 'resolved')::int AS resolved,
      COUNT(*) FILTER (WHERE needs_resolution = true)::int AS awaiting_response,
      COUNT(*) FILTER (WHERE linked_service_id IS NOT NULL)::int AS os_created
    FROM filtered_contacts
  ),
  by_channel AS (
    SELECT channel_id, COUNT(*)::int AS cnt
    FROM filtered_contacts
    GROUP BY channel_id
  ),
  by_assignee AS (
    SELECT assigned_to, COUNT(*)::int AS cnt
    FROM filtered_contacts
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
  ),
  per_day AS (
    SELECT
      d::date AS day,
      COUNT(fc.id)::int AS cnt
    FROM generate_series(
      (_today_start - interval '13 days')::date,
      _today_start::date,
      '1 day'::interval
    ) AS d
    LEFT JOIN filtered_contacts fc ON fc.created_at::date = d::date
    GROUP BY d::date
    ORDER BY d::date
  ),
  response_calc AS (
    SELECT
      contact_id,
      is_from_me,
      timestamp,
      LEAD(is_from_me) OVER (PARTITION BY contact_id ORDER BY timestamp) AS next_is_from_me,
      LEAD(timestamp) OVER (PARTITION BY contact_id ORDER BY timestamp) AS next_timestamp
    FROM public.whatsapp_messages
    WHERE organization_id = _org_id
      AND timestamp >= _thirty_days_ago
      AND (_channel_id IS NULL OR channel_id = _channel_id)
  ),
  avg_response AS (
    SELECT COALESCE(
      ROUND(AVG(EXTRACT(EPOCH FROM (next_timestamp - timestamp)) / 60.0)::numeric),
      0
    )::int AS avg_minutes
    FROM response_calc
    WHERE is_from_me = false
      AND next_is_from_me = true
      AND EXTRACT(EPOCH FROM (next_timestamp - timestamp)) BETWEEN 0 AND 86400
  )
  SELECT jsonb_build_object(
    'totalConversations', c.total,
    'convsToday', c.convs_today,
    'convsYesterday', c.convs_yesterday,
    'convsMonth', c.convs_month,
    'resolved', c.resolved,
    'awaitingResponse', c.awaiting_response,
    'osCreated', c.os_created,
    'conversionRate', CASE WHEN c.total > 0 THEN ROUND((c.os_created::numeric / c.total) * 100)::int ELSE 0 END,
    'avgResponseMinutes', ar.avg_minutes,
    'byChannel', COALESCE((SELECT jsonb_agg(jsonb_build_object('channel_id', bc.channel_id, 'count', bc.cnt)) FROM by_channel bc), '[]'::jsonb),
    'byAssignee', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', ba.assigned_to, 'count', ba.cnt)) FROM by_assignee ba), '[]'::jsonb),
    'perDay', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(pd.day, 'DD/MM'), 'count', pd.cnt) ORDER BY pd.day) FROM per_day pd), '[]'::jsonb)
  ) INTO _result
  FROM counts c
  CROSS JOIN avg_response ar;

  RETURN _result;
END;
$$;
