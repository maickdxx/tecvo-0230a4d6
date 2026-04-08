
-- ═══════════════════════════════════════════════════════════
-- CLIENT TOUCHPOINTS — unified contact log
-- ═══════════════════════════════════════════════════════════

CREATE TABLE public.client_touchpoints (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'system',  -- laura, recurrence, automation, manual, system
  category TEXT NOT NULL DEFAULT 'general', -- maintenance, billing, reactivation, followup, service, general
  reference_id TEXT,  -- optional: service_id, recurrence_entry_id, etc.
  status TEXT NOT NULL DEFAULT 'sent', -- sent, responded, ignored, pending
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_touchpoints_org_client ON public.client_touchpoints(organization_id, client_id, created_at DESC);
CREATE INDEX idx_touchpoints_org_recent ON public.client_touchpoints(organization_id, created_at DESC);
CREATE INDEX idx_touchpoints_client_category ON public.client_touchpoints(client_id, category, created_at DESC);

-- RLS
ALTER TABLE public.client_touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view touchpoints"
  ON public.client_touchpoints FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.organization_id = client_touchpoints.organization_id
    )
  );

CREATE POLICY "Org members can insert touchpoints"
  ON public.client_touchpoints FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.organization_id = client_touchpoints.organization_id
    )
  );

-- ═══════════════════════════════════════════════════════════
-- can_touch_client — backend blocking function
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.can_touch_client(
  _org_id UUID,
  _client_id UUID,
  _category TEXT DEFAULT 'general'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  cooldown_days INT;
  last_touch TIMESTAMPTZ;
  has_active_recurrence BOOLEAN;
BEGIN
  -- Category-specific cooldowns
  cooldown_days := CASE _category
    WHEN 'maintenance' THEN 7
    WHEN 'billing' THEN 7
    WHEN 'reactivation' THEN 30
    WHEN 'followup' THEN 3
    WHEN 'service' THEN 1
    ELSE 5
  END;

  -- Check active recurrence
  SELECT EXISTS(
    SELECT 1 FROM public.recurrence_entries
    WHERE organization_id = _org_id
      AND client_id = _client_id
      AND is_active = true
  ) INTO has_active_recurrence;

  -- If in active recurrence and category is reactivation, block
  IF has_active_recurrence AND _category = 'reactivation' THEN
    RETURN false;
  END IF;

  -- Check last touchpoint in this category
  SELECT MAX(created_at) INTO last_touch
  FROM public.client_touchpoints
  WHERE organization_id = _org_id
    AND client_id = _client_id
    AND category = _category;

  -- No previous touch = allowed
  IF last_touch IS NULL THEN
    RETURN true;
  END IF;

  -- Check cooldown
  RETURN last_touch < (now() - (cooldown_days || ' days')::INTERVAL);
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- get_client_contact_decisions — pre-computed decision engine
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_client_contact_decisions(_org_id UUID)
RETURNS TABLE(
  client_id UUID,
  client_name TEXT,
  contact_status TEXT,
  block_reason TEXT,
  next_allowed_date DATE,
  last_touch_date TIMESTAMPTZ,
  last_touch_source TEXT,
  last_touch_category TEXT,
  has_active_recurrence BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Validate org access
  PERFORM validate_org_access(_org_id);

  RETURN QUERY
  WITH recent_touches AS (
    SELECT DISTINCT ON (ct.client_id)
      ct.client_id,
      ct.created_at AS last_touch_at,
      ct.source AS touch_source,
      ct.category AS touch_category
    FROM public.client_touchpoints ct
    WHERE ct.organization_id = _org_id
      AND ct.created_at > now() - INTERVAL '30 days'
    ORDER BY ct.client_id, ct.created_at DESC
  ),
  active_recurrences AS (
    SELECT re.client_id, true AS is_active
    FROM public.recurrence_entries re
    WHERE re.organization_id = _org_id
      AND re.is_active = true
  ),
  active_clients AS (
    -- Clients with services in last 180 days
    SELECT DISTINCT s.client_id
    FROM public.services s
    WHERE s.organization_id = _org_id
      AND s.scheduled_date > now() - INTERVAL '180 days'
      AND s.deleted_at IS NULL
  )
  SELECT
    c.id AS client_id,
    c.name AS client_name,
    CASE
      WHEN ar.is_active THEN 'in_recurrence'
      WHEN rt.last_touch_at > now() - INTERVAL '3 days' THEN 'recently_contacted'
      WHEN rt.last_touch_at > now() - INTERVAL '7 days' THEN 'cooldown_active'
      ELSE 'eligible_for_contact'
    END AS contact_status,
    CASE
      WHEN ar.is_active THEN 'recurrence_active'
      WHEN rt.last_touch_at > now() - INTERVAL '3 days' THEN 'recent_contact'
      WHEN rt.last_touch_at > now() - INTERVAL '7 days' THEN 'cooldown_period'
      ELSE NULL
    END AS block_reason,
    CASE
      WHEN rt.last_touch_at IS NOT NULL THEN (rt.last_touch_at + INTERVAL '7 days')::DATE
      ELSE CURRENT_DATE
    END AS next_allowed_date,
    rt.last_touch_at AS last_touch_date,
    rt.touch_source AS last_touch_source,
    rt.touch_category AS last_touch_category,
    COALESCE(ar.is_active, false) AS has_active_recurrence
  FROM public.clients c
  INNER JOIN active_clients ac ON ac.client_id = c.id
  LEFT JOIN recent_touches rt ON rt.client_id = c.id
  LEFT JOIN active_recurrences ar ON ar.client_id = c.id
  WHERE c.organization_id = _org_id
    AND c.deleted_at IS NULL
  ORDER BY
    CASE
      WHEN ar.is_active THEN 3
      WHEN rt.last_touch_at > now() - INTERVAL '3 days' THEN 2
      WHEN rt.last_touch_at > now() - INTERVAL '7 days' THEN 1
      ELSE 0
    END,
    c.name;
END;
$$;
