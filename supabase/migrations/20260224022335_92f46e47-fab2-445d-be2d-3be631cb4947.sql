
-- 1. Add is_demo_data column to clients, services, and transactions
ALTER TABLE public.clients ADD COLUMN is_demo_data boolean NOT NULL DEFAULT false;
ALTER TABLE public.services ADD COLUMN is_demo_data boolean NOT NULL DEFAULT false;
ALTER TABLE public.transactions ADD COLUMN is_demo_data boolean NOT NULL DEFAULT false;

-- 2. Create function to generate demo data for a new organization
CREATE OR REPLACE FUNCTION public.generate_demo_data(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  c1_id uuid; c2_id uuid; c3_id uuid; c4_id uuid;
  s_id uuid;
  cash_account_id uuid;
  today date := CURRENT_DATE;
  base_ts timestamptz;
BEGIN
  -- Get the default cash financial account created by payment methods trigger
  SELECT id INTO cash_account_id
  FROM public.financial_accounts
  WHERE organization_id = _org_id AND account_type = 'cash'
  LIMIT 1;

  -- If no account yet (shouldn't happen), skip financial part
  IF cash_account_id IS NULL THEN
    cash_account_id := gen_random_uuid(); -- fallback, won't link
  END IF;

  -- Set monthly goal at a level where demo data represents ~35%
  UPDATE public.organizations
  SET monthly_goal = 15000
  WHERE id = _org_id;

  -- ===================== CLIENTS =====================
  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES
    (gen_random_uuid(), _org_id, 'Maria Silva', '(11) 99999-1234', 'pf', 'maria@exemplo.com', 'São Paulo', 'SP', true)
  RETURNING id INTO c1_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES
    (gen_random_uuid(), _org_id, 'João Oliveira', '(11) 98888-5678', 'pf', 'joao@exemplo.com', 'São Paulo', 'SP', true)
  RETURNING id INTO c2_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES
    (gen_random_uuid(), _org_id, 'Empresa ABC Ltda', '(11) 3333-4444', 'pj', 'contato@abc.com', 'Campinas', 'SP', true)
  RETURNING id INTO c3_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES
    (gen_random_uuid(), _org_id, 'Ana Costa', '(21) 97777-8888', 'pf', 'ana@exemplo.com', 'Rio de Janeiro', 'RJ', true)
  RETURNING id INTO c4_id;

  -- ===================== SERVICES =====================
  -- Service 1: Completed cleaning (yesterday)
  base_ts := (today - 1)::date + interval '9 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'cleaning', 'completed', base_ts, base_ts + interval '2 hours', 350, 'Limpeza de split 12000 BTUs - Sala', 0, true)
  RETURNING id INTO s_id;
  -- Income transaction for completed service
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c1_id, 'income', 'service', 350, 'Limpeza - Maria Silva', (today - 1)::text, 'paid', 'pix', (today - 1)::text, cash_account_id, true);

  -- Service 2: Completed installation (2 days ago)
  base_ts := (today - 2)::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c3_id, 'installation', 'completed', base_ts, base_ts + interval '3 hours', 1800, 'Instalação de 2 splits 18000 BTUs - Escritório', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c3_id, 'income', 'service', 1800, 'Instalação - Empresa ABC', (today - 2)::text, 'paid', 'credit_card', (today - 2)::text, cash_account_id, true);

  -- Service 3: Completed maintenance (3 days ago)
  base_ts := (today - 3)::date + interval '10 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c2_id, 'maintenance', 'completed', base_ts, base_ts + interval '1.5 hours', 450, 'Manutenção preventiva - Ar condicionado central', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c2_id, 'income', 'service', 450, 'Manutenção - João Oliveira', (today - 3)::text, 'paid', 'cash', (today - 3)::text, cash_account_id, true);

  -- Service 4: Completed cleaning (4 days ago)
  base_ts := (today - 4)::date + interval '8 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c4_id, 'cleaning', 'completed', base_ts, base_ts + interval '1 hour', 280, 'Higienização de split 9000 BTUs - Quarto', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c4_id, 'income', 'service', 280, 'Higienização - Ana Costa', (today - 4)::text, 'paid', 'pix', (today - 4)::text, cash_account_id, true);

  -- Service 5: Scheduled today (pending)
  base_ts := today::date + interval '10 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'maintenance', 'scheduled', base_ts, 520, 'Manutenção corretiva - Compressor com ruído', 0, true);

  -- Service 6: Scheduled tomorrow
  base_ts := (today + 1)::date + interval '9 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c3_id, 'installation', 'scheduled', base_ts, 2200, 'Instalação de cassete 24000 BTUs - Recepção', 0, true);

  -- Service 7: Scheduled in 2 days
  base_ts := (today + 2)::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c2_id, 'cleaning', 'scheduled', base_ts, 380, 'Limpeza de split 12000 BTUs - Sala de reuniões', 0, true);

  -- Service 8: Scheduled in 3 days
  base_ts := (today + 3)::date + interval '11 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c4_id, 'maintenance', 'scheduled', base_ts, 650, 'Recarga de gás R410a - Split 18000 BTUs', 0, true);

  -- ===================== EXPENSE TRANSACTIONS =====================
  -- Some expenses (contas a pagar)
  INSERT INTO public.transactions (organization_id, type, category, amount, description, date, status, due_date, is_demo_data)
  VALUES
    (_org_id, 'expense', 'combustivel', 250, 'Combustível - Semana', (today - 2)::text, 'paid', (today - 2)::text, true),
    (_org_id, 'expense', 'compra_pecas', 480, 'Compra de gás refrigerante R410a', (today - 1)::text, 'paid', (today - 1)::text, true),
    (_org_id, 'expense', 'sistemas_software', 150, 'Assinatura sistema de gestão', today::text, 'pending', (today + 5)::text, true),
    (_org_id, 'expense', 'alimentacao', 85, 'Alimentação equipe', (today - 1)::text, 'paid', (today - 1)::text, true);

  -- A receivable pending (conta a receber)
  INSERT INTO public.transactions (organization_id, client_id, type, category, amount, description, date, status, due_date, is_demo_data)
  VALUES
    (_org_id, c3_id, 'income', 'contrato_recorrente', 1200, 'Contrato mensal PMOC - Empresa ABC', today::text, 'pending', (today + 10)::text, true);

  -- Update financial account balance with paid transactions total
  UPDATE public.financial_accounts
  SET balance = (
    SELECT COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)
    FROM public.transactions t
    WHERE t.organization_id = _org_id AND t.financial_account_id = cash_account_id AND t.status = 'paid' AND t.is_demo_data = true
  )
  WHERE id = cash_account_id;

END;
$$;

-- 3. Create trigger to generate demo data on new organization
CREATE OR REPLACE FUNCTION public.trigger_generate_demo_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_demo_mode = true THEN
    PERFORM public.generate_demo_data(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_generate_demo_data_on_org_create
AFTER INSERT ON public.organizations
FOR EACH ROW
EXECUTE FUNCTION public.trigger_generate_demo_data();
