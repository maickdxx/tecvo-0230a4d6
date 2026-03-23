
CREATE OR REPLACE FUNCTION public.generate_demo_data(_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c1_id uuid;
  c2_id uuid;
  c3_id uuid;
  c4_id uuid;
  s_id uuid;
  today date := CURRENT_DATE;
  base_ts timestamp with time zone;
  cash_account_id uuid;
  existing_clients int;
BEGIN
  -- Check if demo data already exists
  SELECT count(*) INTO existing_clients FROM public.clients WHERE organization_id = _org_id AND is_demo_data = true;
  IF existing_clients > 0 THEN
    RETURN;
  END IF;

  -- Set monthly goal
  UPDATE public.organizations SET monthly_goal = 15000 WHERE id = _org_id;

  -- Get or create a financial account
  SELECT id INTO cash_account_id FROM public.financial_accounts WHERE organization_id = _org_id AND is_active = true LIMIT 1;
  IF cash_account_id IS NULL THEN
    INSERT INTO public.financial_accounts (organization_id, name, account_type, balance, is_active)
    VALUES (_org_id, 'Caixa', 'cash', 0, true)
    RETURNING id INTO cash_account_id;
  END IF;

  -- CLIENTS
  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES (gen_random_uuid(), _org_id, 'Maria Silva', '(11) 99999-1234', 'pf', 'maria@exemplo.com', 'São Paulo', 'SP', true)
  RETURNING id INTO c1_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES (gen_random_uuid(), _org_id, 'João Oliveira', '(11) 98888-5678', 'pf', 'joao@exemplo.com', 'São Paulo', 'SP', true)
  RETURNING id INTO c2_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES (gen_random_uuid(), _org_id, 'Empresa ABC Ltda', '(11) 3333-4444', 'pj', 'contato@abc.com', 'Campinas', 'SP', true)
  RETURNING id INTO c3_id;

  INSERT INTO public.clients (id, organization_id, name, phone, person_type, email, city, state, is_demo_data)
  VALUES (gen_random_uuid(), _org_id, 'Ana Costa', '(21) 97777-8888', 'pf', 'ana@exemplo.com', 'Rio de Janeiro', 'RJ', true)
  RETURNING id INTO c4_id;

  -- Service 1: Completed (yesterday)
  base_ts := (today - 1)::date + interval '9 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'cleaning', 'completed', base_ts, base_ts + interval '2 hours', 350, 'Limpeza de split 12000 BTUs - Sala', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c1_id, 'income', 'service', 350, 'Limpeza - Maria Silva', (today - 1)::date, 'paid', 'pix', (today - 1)::date, cash_account_id, true);

  -- Service 2: Completed (2 days ago)
  base_ts := (today - 2)::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c3_id, 'installation', 'completed', base_ts, base_ts + interval '3 hours', 1800, 'Instalação de 2 splits 18000 BTUs - Escritório', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c3_id, 'income', 'service', 1800, 'Instalação - Empresa ABC', (today - 2)::date, 'paid', 'credit_card', (today - 2)::date, cash_account_id, true);

  -- Service 3: Completed (3 days ago)
  base_ts := (today - 3)::date + interval '10 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c2_id, 'maintenance', 'completed', base_ts, base_ts + interval '1.5 hours', 280, 'Manutenção preventiva - Quarto', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c2_id, 'income', 'service', 280, 'Manutenção - João Oliveira', (today - 3)::date, 'paid', 'cash', (today - 3)::date, cash_account_id, true);

  -- Service 4: Scheduled (today)
  base_ts := today::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c4_id, 'cleaning', 'scheduled', base_ts, 450, 'Limpeza completa - 2 splits', 0, true);

  -- Service 5: Scheduled (tomorrow)
  base_ts := (today + 1)::date + interval '9 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'maintenance', 'scheduled', base_ts, 320, 'Revisão semestral', 0, true);

  -- Service 6: Scheduled (day after tomorrow)
  base_ts := (today + 2)::date + interval '10 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c3_id, 'repair', 'scheduled', base_ts, 550, 'Reparo de vazamento de gás - Split 24000', 0, true);

  -- Expense transaction
  INSERT INTO public.transactions (organization_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, 'expense', 'material', 180, 'Gás refrigerante R410A', (today - 2)::date, 'paid', 'pix', (today - 2)::date, cash_account_id, true);

  -- Update account balance with demo totals
  UPDATE public.financial_accounts
  SET balance = balance + (350 + 1800 + 280 - 180)
  WHERE id = cash_account_id;

END;
$$;
