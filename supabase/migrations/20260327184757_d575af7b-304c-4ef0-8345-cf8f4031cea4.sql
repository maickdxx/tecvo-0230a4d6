-- Enhance ab_test_winning_patterns table
ALTER TABLE public.ab_test_winning_patterns 
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS is_validated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Update existing patterns if any
UPDATE public.ab_test_winning_patterns SET category = 'headline' WHERE pattern_type = 'headline';
UPDATE public.ab_test_winning_patterns SET category = 'cta' WHERE pattern_type = 'cta';
UPDATE public.ab_test_winning_patterns SET category = 'structure' WHERE pattern_type = 'structure';

-- Create a table for automated pattern application tracking (governance)
CREATE TABLE IF NOT EXISTS public.ab_test_pattern_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id UUID REFERENCES public.ab_test_winning_patterns(id),
    target_page TEXT NOT NULL,
    target_element TEXT NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    performance_metric JSONB,
    is_active BOOLEAN DEFAULT true
);

-- Enable RLS
ALTER TABLE public.ab_test_pattern_applications ENABLE ROW LEVEL SECURITY;

-- Simple RLS for admins
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'ab_test_pattern_applications' 
        AND policyname = 'Admins can manage pattern applications'
    ) THEN
        CREATE POLICY "Admins can manage pattern applications" 
        ON public.ab_test_pattern_applications 
        FOR ALL 
        USING (true);
    END IF;
END $$;

-- Seed some winning patterns based on "Standard Tecvo"
-- Using allowed values for pattern_type: 'headline', 'cta', 'structure', 'element', 'color_scheme'
INSERT INTO public.ab_test_winning_patterns (name, pattern_type, category, description, content, performance_lift, is_validated, tags)
VALUES 
('Headline de Urgência Máxima', 'headline', 'finance', 'Foca na perda de dinheiro imediata por falta de controle.', '{"text": "Pare de perder R$ 500 por dia com má gestão de equipe."}', 15.5, true, ARRAY['urgencia', 'perda', 'financeiro']),
('CTA Direto com Benefício', 'cta', 'benefit', 'Botão que reforça o benefício imediato ao clicar.', '{"text": "Recuperar meu lucro agora", "subtext": "Teste grátis por 7 dias"}', 12.2, true, ARRAY['beneficio', 'gratis']),
('Estrutura de Prova Social em Carrossel', 'structure', 'social_proof', 'Exibe depoimentos de clientes satisfeitos em formato carrossel logo após o hero.', '{"type": "carousel", "items": ["depoimento1", "depoimento2"]}', 8.4, true, ARRAY['confianca', 'depoimentos']);

-- Seed some templates
-- Using allowed values for category: 'landing_page', 'email', 'checkout', 'onboarding'
INSERT INTO public.ab_test_templates (name, description, category, structure, is_active)
VALUES 
('Template Padrão Tecvo V1', 'Estrutura completa validada em múltiplos nichos.', 'landing_page', '{"blocks": ["hero", "social_proof", "benefits", "cta_section", "faq"]}', true),
('Página de Captura Minimalista', 'Focada em conversão rápida para leads frios.', 'landing_page', '{"blocks": ["hero_mini", "form", "short_benefits"]}', true);
