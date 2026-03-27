-- Phase 1 & 2: Enhancing Marketing Automation Schema and Data

-- 1. Add missing columns to support more channels and control
ALTER TABLE public.analytics_automations ADD COLUMN IF NOT EXISTS email_template TEXT;
ALTER TABLE public.analytics_automation_logs ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'whatsapp';

-- 2. Insert Trial Conversion Journey Templates
-- D0 - Welcome (Immediately after signup_completed)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D0 - Boas-vindas',
    'Mensagem imediata após conclusão do cadastro',
    'trial_d0',
    'Seja bem-vindo à Tecvo! 🚀 Sua máquina de conversão já está pronta. Que tal dar o primeiro passo e criar sua primeira Ordem de Serviço agora?',
    'Bem-vindo à Tecvo! 🚀\n\nEstamos muito felizes em ter você conosco. Sua jornada para transformar sua prestação de serviços começa agora.\n\nPróximo passo: Crie sua primeira Ordem de Serviço no painel.',
    true,
    0,
    24
) ON CONFLICT DO NOTHING;

-- D1 - Activation incentive (24h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D1 - Incentivo de Ativação',
    'Enviado 24h após o cadastro para incentivar a primeira ação',
    'trial_d1',
    'Olá {{name}}! Já explorou o painel hoje? Criar sua primeira OS é o segredo para ver o valor real da Tecvo. Vamos começar?',
    'Como está sua experiência na Tecvo? 📊\n\nNotamos que você ainda não criou sua primeira Ordem de Serviço. Sabia que isso leva menos de 2 minutos? Acesse o painel e experimente!',
    true,
    1440,
    24
) ON CONFLICT DO NOTHING;

-- D3 - Social Proof (72h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D3 - Prova Social',
    'Enviado no 3º dia reforçando benefícios com exemplos',
    'trial_d3',
    'Sabia que empresas que usam a Tecvo reduzem em 30% o tempo de faturamento? O João da ABC Ar-condicionado já está colhendo os frutos! 🏆',
    'Resultados Reais com a Tecvo 🏆\n\nNossos clientes estão economizando horas de trabalho manual todos os dias. Veja como você também pode otimizar sua gestão.',
    true,
    4320,
    24
) ON CONFLICT DO NOTHING;

-- D5 - Pain Point (120h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D5 - Reforço de Dor',
    'Enviado no 5º dia sobre o que o usuário perde sem o sistema',
    'trial_d5',
    'Ainda perdendo tempo com planilhas? A Tecvo elimina o retrabalho e foca no que importa: seu lucro. Não deixe seu trial expirar sem testar tudo! 🔥',
    'Chega de planilhas e papelada! 📑\n\nA Tecvo foi feita para libertar você do trabalho burocrático. Aproveite os dias restantes do seu trial para automatizar seus processos.',
    true,
    7200,
    24
) ON CONFLICT DO NOTHING;

-- D7 - Mid-point Value (168h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D7 - Valor Real',
    'Enviado no 7º dia mostrando valor e incentivo de pagamento',
    'trial_d7',
    '7 dias de Tecvo! 📊 Como está sendo sua experiência? Se precisar de ajuda para configurar algo, estamos aqui. Ah, confira nossos planos se quiser garantir sua vaga.',
    'Sua primeira semana com a Tecvo 📊\n\nJá deu para sentir a diferença? Estamos aqui para garantir que você aproveite ao máximo. Conheça nossos planos e escolha o que melhor se adapta ao seu negócio.',
    true,
    10080,
    24
) ON CONFLICT DO NOTHING;

-- D10 - Urgency Light (240h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D10 - Urgência Leve',
    'Enviado no 10º dia avisando sobre o fim do trial',
    'trial_d10',
    'Opa, {{name}}! Seu trial está chegando na reta final. Faltam apenas 4 dias. Já pensou em como a Tecvo pode escalar seu negócio?',
    'Seu trial está terminando... ⏳\n\nFaltam apenas 4 dias para o fim do seu período de teste. Não perca a chance de profissionalizar sua gestão definitivamente.',
    true,
    14400,
    24
) ON CONFLICT DO NOTHING;

-- D13 - Strong Urgency (312h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D13 - Urgência Forte',
    'Enviado no 13º dia com chamada direta para pagamento',
    'trial_d13',
    '⚠️ Alerta de Urgência: Seu acesso trial expira amanhã! Garanta a continuidade dos seus dados e processos migrando para o plano Pro agora.',
    '⚠️ Último aviso: Seu trial expira AMANHÃ!\n\nEvite a interrupção dos seus serviços. Ative sua assinatura agora e mantenha todos os seus dados e processos ativos.',
    true,
    18720,
    24
) ON CONFLICT DO NOTHING;

-- D14 - Last Call (336h)
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial D14 - Última Chamada',
    'Enviado no último dia com oferta clara',
    'trial_d14',
    'Hoje é o último dia! 🕒 Não perca tudo o que você construiu aqui. Ative sua assinatura agora e continue crescendo com a Tecvo.',
    'É HOJE! 🕒\n\nSeu período de trial encerra hoje. Clique aqui para ativar sua conta e não perder o acesso ao sistema.',
    true,
    20160,
    24
) ON CONFLICT DO NOTHING;

-- Billing Specific Alerts
INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial Ending 3 Days',
    'Alerta de 3 dias antes do vencimento do trial',
    'trial_ending_3d',
    'Seu trial termina em 3 dias. Evite interrupções!',
    'Seu período de teste termina em 3 dias. Ative sua assinatura para continuar usando sem interrupções.',
    true,
    0,
    24
) ON CONFLICT DO NOTHING;

INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial Ending 1 Day',
    'Alerta de 1 dia antes do vencimento do trial',
    'trial_ending_1d',
    'Amanhã é o dia! Ative agora seu plano Pro e garanta seu acesso.',
    'Amanhã seu trial expira. Não deixe para a última hora!',
    true,
    0,
    24
) ON CONFLICT DO NOTHING;

INSERT INTO public.analytics_automations (name, description, trigger_type, message_template, email_template, enabled, delay_minutes, cooldown_hours)
VALUES (
    'Trial Ending Today',
    'Alerta no dia do vencimento do trial',
    'trial_ending_0d',
    'Acesso expirado. Reative para continuar usando a Tecvo e escalando seu negócio!',
    'Seu trial expirou hoje. Ative sua assinatura para reaver o acesso aos seus dados.',
    true,
    0,
    24
) ON CONFLICT DO NOTHING;

-- 3. Setup the Cron Job for the Automation Engine
-- Schedule the analytics-automation-engine to run every hour
-- We use net.http_post if available to trigger the function
SELECT cron.schedule(
    'analytics-automation-engine-hourly',
    '0 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://vcuwimodpfbzpuvzesfm.supabase.co/functions/v1/analytics-automation-engine',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjdXdpbW9kcGZienB1dnplc2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA0OTgxMzUsImV4cCI6MjA4NjA3NDEzNX0.dmb2JuILUGIJMJvePNIzMm3ErZvBesjMuzDD6y6vG6s"}'::jsonb,
        body := '{}'::jsonb
    ) as request_id;
    $$
);