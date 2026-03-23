
-- Add ON DELETE CASCADE to all organization_id foreign keys

-- profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_organization_id_fkey;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- clients
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_organization_id_fkey;
ALTER TABLE public.clients ADD CONSTRAINT clients_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- services
ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_organization_id_fkey;
ALTER TABLE public.services ADD CONSTRAINT services_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- service_photos
ALTER TABLE public.service_photos DROP CONSTRAINT IF EXISTS service_photos_organization_id_fkey;
ALTER TABLE public.service_photos ADD CONSTRAINT service_photos_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- service_items
ALTER TABLE public.service_items DROP CONSTRAINT IF EXISTS service_items_organization_id_fkey;
ALTER TABLE public.service_items ADD CONSTRAINT service_items_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- organization_usage
ALTER TABLE public.organization_usage DROP CONSTRAINT IF EXISTS organization_usage_organization_id_fkey;
ALTER TABLE public.organization_usage ADD CONSTRAINT organization_usage_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- service_types
ALTER TABLE public.service_types DROP CONSTRAINT IF EXISTS service_types_organization_id_fkey;
ALTER TABLE public.service_types ADD CONSTRAINT service_types_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- transaction_categories
ALTER TABLE public.transaction_categories DROP CONSTRAINT IF EXISTS transaction_categories_organization_id_fkey;
ALTER TABLE public.transaction_categories ADD CONSTRAINT transaction_categories_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- invites
ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS invites_organization_id_fkey;
ALTER TABLE public.invites ADD CONSTRAINT invites_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- suppliers
ALTER TABLE public.suppliers DROP CONSTRAINT IF EXISTS suppliers_organization_id_fkey;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- catalog_services
ALTER TABLE public.catalog_services DROP CONSTRAINT IF EXISTS catalog_services_organization_id_fkey;
ALTER TABLE public.catalog_services ADD CONSTRAINT catalog_services_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- payment_methods
ALTER TABLE public.payment_methods DROP CONSTRAINT IF EXISTS payment_methods_organization_id_fkey;
ALTER TABLE public.payment_methods ADD CONSTRAINT payment_methods_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- support_conversations
ALTER TABLE public.support_conversations DROP CONSTRAINT IF EXISTS support_conversations_organization_id_fkey;
ALTER TABLE public.support_conversations ADD CONSTRAINT support_conversations_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- employee_expenses
ALTER TABLE public.employee_expenses DROP CONSTRAINT IF EXISTS employee_expenses_organization_id_fkey;
ALTER TABLE public.employee_expenses ADD CONSTRAINT employee_expenses_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- member_permissions
ALTER TABLE public.member_permissions DROP CONSTRAINT IF EXISTS member_permissions_organization_id_fkey;
ALTER TABLE public.member_permissions ADD CONSTRAINT member_permissions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- ai_assistant_permissions
ALTER TABLE public.ai_assistant_permissions DROP CONSTRAINT IF EXISTS ai_assistant_permissions_organization_id_fkey;
ALTER TABLE public.ai_assistant_permissions ADD CONSTRAINT ai_assistant_permissions_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- feedback
ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_organization_id_fkey;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- financial_accounts
ALTER TABLE public.financial_accounts DROP CONSTRAINT IF EXISTS financial_accounts_organization_id_fkey;
ALTER TABLE public.financial_accounts ADD CONSTRAINT financial_accounts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- service_payments
ALTER TABLE public.service_payments DROP CONSTRAINT IF EXISTS service_payments_organization_id_fkey;
ALTER TABLE public.service_payments ADD CONSTRAINT service_payments_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- time_clock_settings
ALTER TABLE public.time_clock_settings DROP CONSTRAINT IF EXISTS time_clock_settings_organization_id_fkey;
ALTER TABLE public.time_clock_settings ADD CONSTRAINT time_clock_settings_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- time_clock_entries
ALTER TABLE public.time_clock_entries DROP CONSTRAINT IF EXISTS time_clock_entries_organization_id_fkey;
ALTER TABLE public.time_clock_entries ADD CONSTRAINT time_clock_entries_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- time_clock_adjustments
ALTER TABLE public.time_clock_adjustments DROP CONSTRAINT IF EXISTS time_clock_adjustments_organization_id_fkey;
ALTER TABLE public.time_clock_adjustments ADD CONSTRAINT time_clock_adjustments_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- time_clock_audit_log
ALTER TABLE public.time_clock_audit_log DROP CONSTRAINT IF EXISTS time_clock_audit_log_organization_id_fkey;
ALTER TABLE public.time_clock_audit_log ADD CONSTRAINT time_clock_audit_log_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- time_clock_inconsistencies
ALTER TABLE public.time_clock_inconsistencies DROP CONSTRAINT IF EXISTS time_clock_inconsistencies_organization_id_fkey;
ALTER TABLE public.time_clock_inconsistencies ADD CONSTRAINT time_clock_inconsistencies_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- pmoc_contracts
ALTER TABLE public.pmoc_contracts DROP CONSTRAINT IF EXISTS pmoc_contracts_organization_id_fkey;
ALTER TABLE public.pmoc_contracts ADD CONSTRAINT pmoc_contracts_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- pmoc_equipment
ALTER TABLE public.pmoc_equipment DROP CONSTRAINT IF EXISTS pmoc_equipment_organization_id_fkey;
ALTER TABLE public.pmoc_equipment ADD CONSTRAINT pmoc_equipment_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- pmoc_checklists
ALTER TABLE public.pmoc_checklists DROP CONSTRAINT IF EXISTS pmoc_checklists_organization_id_fkey;
ALTER TABLE public.pmoc_checklists ADD CONSTRAINT pmoc_checklists_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
