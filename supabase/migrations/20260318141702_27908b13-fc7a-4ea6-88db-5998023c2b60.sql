-- =====================================================
-- ÍNDICES CRÍTICOS DE PERFORMANCE
-- Baseados em EXPLAIN ANALYZE e pg_stat_user_tables
-- =====================================================

-- 1. whatsapp_messages: query principal do chat filtra por contact_id
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_contact_id_created 
ON public.whatsapp_messages (contact_id, created_at DESC);

-- 2. whatsapp_channels: 37K seq scans, apenas 4 rows
CREATE INDEX IF NOT EXISTS idx_whatsapp_channels_org_id 
ON public.whatsapp_channels (organization_id);

-- 3. whatsapp_bot_executions: 54K seq scans 
CREATE INDEX IF NOT EXISTS idx_whatsapp_bot_executions_org_id 
ON public.whatsapp_bot_executions (organization_id);

-- 4. assistant_messages: 3K seq scans, 0 idx scans
CREATE INDEX IF NOT EXISTS idx_assistant_messages_conversation_id 
ON public.assistant_messages (conversation_id, created_at DESC);

-- 5. transaction_categories: 1.9K seq scans com 1632 rows
CREATE INDEX IF NOT EXISTS idx_transaction_categories_org_id 
ON public.transaction_categories (organization_id);

-- 6. whatsapp_contacts: índice composto para query principal de inbox
CREATE INDEX IF NOT EXISTS idx_whatsapp_contacts_org_inbox 
ON public.whatsapp_contacts (organization_id, channel_id, is_blocked, has_conversation, last_message_at DESC NULLS LAST);

-- 7. organization_usage: 17K seq scans
CREATE INDEX IF NOT EXISTS idx_org_usage_org_month 
ON public.organization_usage (organization_id, month_year);

-- 8. services: índices compostos para dashboard e agenda
CREATE INDEX IF NOT EXISTS idx_services_org_completed 
ON public.services (organization_id, completed_date) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_services_org_scheduled 
ON public.services (organization_id, scheduled_date) 
WHERE deleted_at IS NULL;

-- 9. time_clock_adjustments: 6.2K seq scans
CREATE INDEX IF NOT EXISTS idx_time_clock_adjustments_org_id 
ON public.time_clock_adjustments (organization_id);

CREATE INDEX IF NOT EXISTS idx_time_clock_adjustments_entry_id 
ON public.time_clock_adjustments (entry_id);

-- 10. financial_accounts: 7.3K seq scans
CREATE INDEX IF NOT EXISTS idx_financial_accounts_org_id 
ON public.financial_accounts (organization_id);