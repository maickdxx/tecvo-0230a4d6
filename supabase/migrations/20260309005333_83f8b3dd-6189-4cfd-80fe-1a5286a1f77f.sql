-- AI Credits Balance Table
CREATE TABLE public.ai_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Credit Transactions Log
CREATE TABLE public.ai_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  amount INTEGER NOT NULL,
  action_type TEXT NOT NULL,
  description TEXT,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- AI Credit Config (adjustable costs per action)
CREATE TABLE public.ai_credit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_slug TEXT NOT NULL UNIQUE,
  credits_cost INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default credit costs
INSERT INTO public.ai_credit_config (action_slug, credits_cost, label) VALUES
  ('copilot_response', 1, 'Copiloto de resposta'),
  ('analyze_conversation', 3, 'Analisar conversa'),
  ('create_os_ai', 3, 'Criar OS com IA');

-- Enable RLS
ALTER TABLE public.ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_credit_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_credits
CREATE POLICY "Users can view their organization credits" ON public.ai_credits
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- RLS Policies for ai_credit_transactions
CREATE POLICY "Users can view their organization transactions" ON public.ai_credit_transactions
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- RLS Policies for ai_credit_config (public read, admin write)
CREATE POLICY "Anyone can read credit config" ON public.ai_credit_config
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Super admins can manage credit config" ON public.ai_credit_config
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Super admin policies for managing all credits
CREATE POLICY "Super admins can view all credits" ON public.ai_credits
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can update all credits" ON public.ai_credits
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert credits" ON public.ai_credits
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can view all transactions" ON public.ai_credit_transactions
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert transactions" ON public.ai_credit_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Function to initialize credits for new organizations
CREATE OR REPLACE FUNCTION public.initialize_ai_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.ai_credits (organization_id, balance)
  VALUES (NEW.id, 50);
  
  INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description)
  VALUES (NEW.id, 50, 'initial_grant', 'Créditos iniciais de boas-vindas');
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create credits for new orgs
CREATE TRIGGER trigger_initialize_ai_credits
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_ai_credits();

-- Function to consume credits (used by edge functions)
CREATE OR REPLACE FUNCTION public.consume_ai_credits(
  _org_id UUID,
  _action_slug TEXT,
  _user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _cost INTEGER;
  _current_balance INTEGER;
  _action_label TEXT;
BEGIN
  -- Get cost for this action
  SELECT credits_cost, label INTO _cost, _action_label
  FROM public.ai_credit_config
  WHERE action_slug = _action_slug;
  
  IF _cost IS NULL THEN
    RAISE EXCEPTION 'Unknown action: %', _action_slug;
  END IF;
  
  -- Get current balance
  SELECT balance INTO _current_balance
  FROM public.ai_credits
  WHERE organization_id = _org_id
  FOR UPDATE;
  
  -- If no credits record exists, create one with 0 balance
  IF _current_balance IS NULL THEN
    INSERT INTO public.ai_credits (organization_id, balance)
    VALUES (_org_id, 0)
    RETURNING balance INTO _current_balance;
  END IF;
  
  -- Check if enough balance
  IF _current_balance < _cost THEN
    RETURN FALSE;
  END IF;
  
  -- Deduct credits
  UPDATE public.ai_credits
  SET balance = balance - _cost, updated_at = now()
  WHERE organization_id = _org_id;
  
  -- Log transaction
  INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description, user_id)
  VALUES (_org_id, -_cost, _action_slug, _action_label, _user_id);
  
  RETURN TRUE;
END;
$$;

-- Function to add credits (for purchases or admin grants)
CREATE OR REPLACE FUNCTION public.add_ai_credits(
  _org_id UUID,
  _amount INTEGER,
  _action_type TEXT,
  _description TEXT,
  _user_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _new_balance INTEGER;
BEGIN
  -- Upsert credits
  INSERT INTO public.ai_credits (organization_id, balance)
  VALUES (_org_id, _amount)
  ON CONFLICT (organization_id) DO UPDATE
  SET balance = ai_credits.balance + _amount, updated_at = now()
  RETURNING balance INTO _new_balance;
  
  -- Log transaction
  INSERT INTO public.ai_credit_transactions (organization_id, amount, action_type, description, user_id)
  VALUES (_org_id, _amount, _action_type, _description, _user_id);
  
  RETURN _new_balance;
END;
$$;

-- Initialize credits for existing organizations that don't have them
INSERT INTO public.ai_credits (organization_id, balance)
SELECT id, 50 FROM public.organizations
WHERE id NOT IN (SELECT organization_id FROM public.ai_credits)
ON CONFLICT (organization_id) DO NOTHING;