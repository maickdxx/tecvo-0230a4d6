-- Enhanced Anomaly Detection
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
    FROM public.user_activity_events
    WHERE event_type = 'signup_started'
    AND created_at < NOW() - INTERVAL '30 minutes'
    AND user_id NOT IN (
        SELECT user_id FROM public.user_activity_events WHERE event_type = 'signup_completed'
    )
    AND NOT EXISTS (
        SELECT 1 FROM public.analytics_alerts 
        WHERE alert_type = 'signup_abandonment' 
        AND (metadata->>'user_id')::uuid = user_id
        AND created_at > NOW() - INTERVAL '24 hours'
    )
    LIMIT 5;

    -- Alert: Potential Churn Risk
    INSERT INTO public.analytics_alerts (alert_type, severity, message, metadata)
    SELECT 
        'churn_risk',
        'high',
        'Usuário engajado está inativo há mais de 7 dias.',
        jsonb_build_object('user_id', user_id)
    FROM public.view_analytics_user_scores
    WHERE classification = 'engajado' AND is_churn_risk = true
    AND NOT EXISTS (
        SELECT 1 FROM public.analytics_alerts 
        WHERE alert_type = 'churn_risk' 
        AND (metadata->>'user_id')::uuid = user_id
        AND created_at > NOW() - INTERVAL '7 days'
    )
    LIMIT 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
