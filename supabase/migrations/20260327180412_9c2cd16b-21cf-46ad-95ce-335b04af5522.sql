-- Create function to update timestamps if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create automations table
CREATE TABLE IF NOT EXISTS public.analytics_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL, -- 'signup_recovery', 'new_user_activation', 'churn_recovery'
    message_template TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    cooldown_hours INTEGER DEFAULT 24,
    delay_minutes INTEGER DEFAULT 30,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create automation logs table
CREATE TABLE IF NOT EXISTS public.analytics_automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automation_id UUID REFERENCES public.analytics_automations(id) ON DELETE SET NULL,
    user_id UUID,
    email TEXT,
    organization_id UUID,
    status TEXT NOT NULL, -- 'sent', 'error', 'skipped'
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_automation_logs ENABLE ROW LEVEL SECURITY;

-- Policies for superadmins (using super_admin)
CREATE POLICY "Superadmins can manage automations" 
ON public.analytics_automations 
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    )
);

CREATE POLICY "Superadmins can view automation logs" 
ON public.analytics_automation_logs 
FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND role = 'super_admin'
    )
);

-- Insert initial automations
INSERT INTO public.analytics_automations (name, description, trigger_type, delay_minutes, message_template)
VALUES 
('Recuperação de Cadastro', 'Enviado quando o usuário inicia o cadastro mas não conclui em 30 minutos', 'signup_recovery', 30, 'Olá {{name}}! Notamos que você iniciou seu cadastro na Tecvo mas não concluiu. Ficou alguma dúvida? Posso te ajudar a finalizar? 😊'),
('Ativação de Novos Usuários', 'Enviado 24 horas após o cadastro se o usuário não criou nenhuma OS', 'new_user_activation', 1440, 'Olá {{name}}! Vi que você já está com acesso à Tecvo. Que tal criar sua primeira Ordem de Serviço agora? É super simples! 🚀'),
('Recuperação de Churn (Em Risco)', 'Enviado para usuários classificados como "em risco"', 'churn_recovery', 0, 'Olá {{name}}! Notamos sua ausência na plataforma. Está tudo bem? Gostaria de agendar uma breve conversa para entendermos como podemos te ajudar melhor?');

-- Create trigger for updated_at
CREATE TRIGGER update_analytics_automations_updated_at
BEFORE UPDATE ON public.analytics_automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
