
CREATE OR REPLACE FUNCTION public.get_whatsapp_report_stats(
  _org_id uuid,
  _channel_id uuid DEFAULT NULL,
  _date_from timestamptz DEFAULT NULL,
  _date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
  _today_start timestamptz;
  _yesterday_start timestamptz;
  _month_start timestamptz;
  _thirty_days_ago timestamptz;
  _effective_from timestamptz;
  _effective_to timestamptz;
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

  -- Use provided date range or default to last 30 days
  _effective_from := COALESCE(_date_from, _thirty_days_ago);
  _effective_to := COALESCE(_date_to, now() + interval '1 day');

  WITH filtered_contacts AS (
    SELECT
      c.id,
      c.channel_id,
      c.assigned_to,
      c.conversation_status,
      c.conversion_status,
      c.created_at,
      c.last_message_at,
      c.linked_service_id,
      c.needs_resolution,
      c.is_unread,
      c.last_message_is_from_me
    FROM public.whatsapp_contacts c
    WHERE c.organization_id = _org_id
      AND c.is_group = false
      AND c.has_conversation = true
      AND (_channel_id IS NULL OR c.channel_id = _channel_id)
      AND c.created_at >= _effective_from
      AND c.created_at < _effective_to
  ),
  counts AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE created_at >= _today_start)::int AS convs_today,
      COUNT(*) FILTER (WHERE created_at >= _yesterday_start AND created_at < _today_start)::int AS convs_yesterday,
      COUNT(*) FILTER (WHERE created_at >= _month_start)::int AS convs_month,
      COUNT(*) FILTER (WHERE conversation_status = 'resolvido')::int AS resolved,
      COUNT(*) FILTER (WHERE needs_resolution = true)::int AS awaiting_response,
      COUNT(*) FILTER (WHERE linked_service_id IS NOT NULL)::int AS os_created,
      -- Funnel metrics based on conversion_status
      COUNT(*) FILTER (WHERE conversion_status IN ('em_atendimento','agendado','concluido'))::int AS attended_total,
      COUNT(*) FILTER (WHERE conversion_status = 'em_atendimento')::int AS attended_only,
      COUNT(*) FILTER (WHERE conversion_status IN ('agendado','concluido'))::int AS scheduled_total,
      COUNT(*) FILTER (WHERE conversion_status = 'agendado')::int AS scheduled_only,
      COUNT(*) FILTER (WHERE conversion_status = 'concluido')::int AS converted,
      -- Never responded: contact sent message but org never replied
      COUNT(*) FILTER (WHERE conversion_status = 'novo_contato' AND last_message_is_from_me = false)::int AS never_responded
    FROM filtered_contacts
  ),
  -- Revenue from linked services that are completed
  revenue_calc AS (
    SELECT
      COALESCE(SUM(s.value), 0)::numeric AS total_revenue,
      COUNT(s.id)::int AS completed_count
    FROM filtered_contacts fc
    JOIN public.services s ON s.id = fc.linked_service_id
    WHERE fc.linked_service_id IS NOT NULL
      AND s.status = 'completed'
  ),
  by_channel AS (
    SELECT channel_id, COUNT(*)::int AS cnt
    FROM filtered_contacts
    GROUP BY channel_id
  ),
  by_assignee AS (
    SELECT
      assigned_to,
      COUNT(*)::int AS cnt,
      COUNT(*) FILTER (WHERE conversion_status = 'concluido')::int AS converted_cnt
    FROM filtered_contacts
    WHERE assigned_to IS NOT NULL
    GROUP BY assigned_to
  ),
  per_day AS (
    SELECT
      d::date AS day,
      COUNT(fc.id)::int AS cnt
    FROM generate_series(
      GREATEST((_today_start - interval '13 days')::date, _effective_from::date),
      LEAST(_today_start::date, (_effective_to - interval '1 second')::date),
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
      AND timestamp >= _effective_from
      AND timestamp < _effective_to
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
    'converted', c.converted,
    'attendedOnly', c.attended_only,
    'attendedTotal', c.attended_total,
    'scheduledOnly', c.scheduled_only,
    'scheduledTotal', c.scheduled_total,
    'neverResponded', c.never_responded,
    'conversionCommercial', CASE WHEN c.attended_total > 0 THEN ROUND((c.scheduled_total::numeric / c.attended_total) * 100)::int ELSE 0 END,
    'conversionOperational', CASE WHEN c.scheduled_total > 0 THEN ROUND((c.converted::numeric / c.scheduled_total) * 100)::int ELSE 0 END,
    'conversionTotal', CASE WHEN c.total > 0 THEN ROUND((c.converted::numeric / c.total) * 100)::int ELSE 0 END,
    'totalRevenue', rc.total_revenue,
    'avgTicket', CASE WHEN rc.completed_count > 0 THEN ROUND(rc.total_revenue / rc.completed_count) ELSE 0 END,
    'avgResponseMinutes', ar.avg_minutes,
    'byChannel', COALESCE((SELECT jsonb_agg(jsonb_build_object('channel_id', bc.channel_id, 'count', bc.cnt)) FROM by_channel bc), '[]'::jsonb),
    'byAssignee', COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id', ba.assigned_to, 'count', ba.cnt, 'converted', ba.converted_cnt)) FROM by_assignee ba), '[]'::jsonb),
    'perDay', COALESCE((SELECT jsonb_agg(jsonb_build_object('date', to_char(pd.day, 'DD/MM'), 'count', pd.cnt) ORDER BY pd.day) FROM per_day pd), '[]'::jsonb)
  ) INTO _result
  FROM counts c
  CROSS JOIN avg_response ar
  CROSS JOIN revenue_calc rc;

  RETURN _result;
END;
$function$;
