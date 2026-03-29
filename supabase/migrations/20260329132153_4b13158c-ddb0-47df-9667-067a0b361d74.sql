
-- 1. Create user_journey_state table
CREATE TABLE public.user_journey_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid,
  journey_type text NOT NULL DEFAULT 'trial',
  current_step text,
  last_automation_id uuid REFERENCES public.analytics_automations(id),
  last_sent_at timestamptz,
  last_sent_date date,
  journey_started_at timestamptz NOT NULL DEFAULT now(),
  journey_ended_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, journey_type)
);

ALTER TABLE public.user_journey_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on user_journey_state"
  ON public.user_journey_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. Add post-trial automations
INSERT INTO public.analytics_automations (name, trigger_type, message_template, delay_minutes, enabled, description)
VALUES
  ('Pós-Trial D+1 - Recuperação', 'post_trial_d1', 'Olá {{name}}! Seu período de teste terminou, mas seus dados ainda estão salvos. Que tal reativar e continuar de onde parou? 💪', 0, true, 'Enviada 1 dia após o trial expirar'),
  ('Pós-Trial D+3 - Reforço', 'post_trial_d3', 'Oi {{name}}, sentimos sua falta! Empresas como a sua estão crescendo com a Tecvo. Volte e veja o que mudou! 🚀', 0, true, 'Enviada 3 dias após o trial expirar'),
  ('Pós-Trial D+7 - Última chance', 'post_trial_d7', '{{name}}, última chamada! Seus dados serão arquivados em breve. Reative agora para não perder nada. ⏰', 0, true, 'Enviada 7 dias após o trial expirar');

-- 3. Disable D0 (handled by welcome whatsapp) and legacy D10/D13/D14
UPDATE public.analytics_automations SET enabled = false WHERE trigger_type = 'trial_d0';
UPDATE public.analytics_automations SET enabled = false WHERE trigger_type IN ('trial_d10', 'trial_d13', 'trial_d14');

-- 4. Fix delay_minutes to match correct day values for the engine
-- These will now be used as "days since signup" by the new engine, 
-- but we keep them for reference. The new engine uses day calculation instead.
