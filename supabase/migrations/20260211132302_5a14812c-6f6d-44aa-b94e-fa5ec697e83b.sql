
-- Create feedback table
CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('bug', 'melhoria', 'sugestao')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_analise', 'resolvido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback"
ON public.feedback FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND organization_id = (SELECT organization_id FROM public.profiles WHERE user_id = auth.uid())
);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback"
ON public.feedback FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
);
