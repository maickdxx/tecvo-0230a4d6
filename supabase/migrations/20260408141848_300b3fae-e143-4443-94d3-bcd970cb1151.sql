
-- Reconciliation function to fix pipeline drift
CREATE OR REPLACE FUNCTION public.reconcile_whatsapp_pipeline()
RETURNS TABLE(contact_id uuid, contact_name text, old_status text, new_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Fix contacts stuck in agendado/em_execucao with no active services
  RETURN QUERY
  WITH stale AS (
    SELECT wc.id, wc.name, wc.conversion_status AS old_cs, wc.conversation_status,
      CASE 
        WHEN wc.conversation_status = 'resolvido' THEN 'concluido'
        ELSE 'pos_atendimento'
      END AS new_cs
    FROM whatsapp_contacts wc
    JOIN clients c ON c.id = wc.linked_client_id
    JOIN services s ON s.client_id = c.id AND s.organization_id = wc.organization_id AND s.deleted_at IS NULL
    WHERE wc.conversion_status IN ('agendado', 'em_execucao')
      AND wc.is_blocked = false
    GROUP BY wc.id, wc.name, wc.conversion_status, wc.conversation_status
    HAVING COUNT(CASE WHEN s.status::text NOT IN ('completed', 'cancelled') THEN 1 END) = 0
  ),
  updated AS (
    UPDATE whatsapp_contacts wc
    SET conversion_status = stale.new_cs
    FROM stale
    WHERE wc.id = stale.id
    RETURNING wc.id, stale.name, stale.old_cs, stale.new_cs
  )
  SELECT updated.id, updated.name, updated.old_cs, updated.new_cs FROM updated;
END;
$$;
