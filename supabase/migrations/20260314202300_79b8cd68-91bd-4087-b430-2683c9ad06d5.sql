
-- Audit log for WhatsApp message actions (edit/delete)
CREATE TABLE public.whatsapp_message_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('edit', 'delete_all', 'delete_local')),
  performed_by uuid NOT NULL,
  original_content text,
  new_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_message_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view audit" ON public.whatsapp_message_audit
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Org members can insert audit" ON public.whatsapp_message_audit
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE INDEX idx_whatsapp_message_audit_org ON public.whatsapp_message_audit(organization_id);
CREATE INDEX idx_whatsapp_message_audit_msg ON public.whatsapp_message_audit(message_id);
