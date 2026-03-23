
-- ─── Chatbot Flows ──────────────────────────────────────────────────────────
CREATE TABLE public.whatsapp_chatbot_flows (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_id      uuid REFERENCES public.whatsapp_channels(id) ON DELETE SET NULL,
  name            text NOT NULL,
  description     text,
  trigger_type    text NOT NULL DEFAULT 'new_conversation',
  trigger_config  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active       boolean NOT NULL DEFAULT false,
  priority        integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_chatbot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chatbot flows in their org"
  ON public.whatsapp_chatbot_flows
  FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE TRIGGER update_whatsapp_chatbot_flows_updated_at
  BEFORE UPDATE ON public.whatsapp_chatbot_flows
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Chatbot Steps ───────────────────────────────────────────────────────────
CREATE TABLE public.whatsapp_chatbot_steps (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id         uuid NOT NULL REFERENCES public.whatsapp_chatbot_flows(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_order      integer NOT NULL DEFAULT 0,
  step_type       text NOT NULL DEFAULT 'send_message',
  config          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_chatbot_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chatbot steps in their org"
  ON public.whatsapp_chatbot_steps
  FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- ─── Chatbot Sessions ────────────────────────────────────────────────────────
CREATE TABLE public.whatsapp_chatbot_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id            uuid NOT NULL REFERENCES public.whatsapp_chatbot_flows(id) ON DELETE CASCADE,
  contact_id         uuid REFERENCES public.whatsapp_contacts(id) ON DELETE CASCADE,
  organization_id    uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step_order integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'active',
  resume_at          timestamptz,
  started_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_chatbot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage chatbot sessions in their org"
  ON public.whatsapp_chatbot_sessions
  FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE TRIGGER update_whatsapp_chatbot_sessions_updated_at
  BEFORE UPDATE ON public.whatsapp_chatbot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chatbot_flows;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chatbot_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chatbot_sessions;
