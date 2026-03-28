CREATE OR REPLACE FUNCTION public.generate_demo_data(_org_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT count(*) INTO existing_clients FROM public.clients WHERE organization_id = _org_id AND is_demo_data = true;
  IF existing_clients > 0 THEN
    RETURN;
  END IF;

  UPDATE public.organizations SET monthly_goal = 15000 WHERE id = _org_id;

  SELECT id INTO cash_account_id FROM public.financial_accounts WHERE organization_id = _org_id AND is_active = true LIMIT 1;
  IF cash_account_id IS NULL THEN
    INSERT INTO public.financial_accounts (organization_id, name, account_type, balance, is_active)
    VALUES (_org_id, 'Caixa', 'cash', 0, true)
    RETURNING id INTO cash_account_id;
  END IF;

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

  base_ts := (today - 1)::date + interval '9 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'limpeza', 'completed', base_ts, base_ts + interval '2 hours', 350, 'Limpeza de split 12000 BTUs - Sala', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c1_id, 'income', 'service', 350, 'Limpeza - Maria Silva', (today - 1)::date, 'paid', 'pix', (today - 1)::date, cash_account_id, true);

  base_ts := (today - 2)::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c3_id, 'instalacao', 'completed', base_ts, base_ts + interval '3 hours', 1800, 'Instalação de 2 splits 18000 BTUs - Escritório', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c3_id, 'income', 'service', 1800, 'Instalação - Empresa ABC', (today - 2)::date, 'paid', 'credit_card', (today - 2)::date, cash_account_id, true);

  base_ts := (today - 3)::date + interval '10 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, completed_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c2_id, 'manutencao', 'completed', base_ts, base_ts + interval '1.5 hours', 280, 'Manutenção preventiva - Quarto', 0, true)
  RETURNING id INTO s_id;
  INSERT INTO public.transactions (organization_id, service_id, client_id, type, category, amount, description, date, status, payment_method, payment_date, financial_account_id, is_demo_data)
  VALUES (_org_id, s_id, c2_id, 'income', 'service', 280, 'Manutenção - João Oliveira', (today - 3)::date, 'paid', 'cash', (today - 3)::date, cash_account_id, true);

  base_ts := today::date + interval '14 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c4_id, 'limpeza', 'scheduled', base_ts, 320, 'Limpeza e higienização - Quarto', 0, true)
  RETURNING id INTO s_id;

  base_ts := (today + 1)::date + interval '11 hours';
  INSERT INTO public.services (organization_id, client_id, service_type, status, scheduled_date, value, description, quote_number, is_demo_data)
  VALUES (_org_id, c1_id, 'manutencao', 'scheduled', base_ts, 260, 'Manutenção corretiva - Condensadora', 0, true)
  RETURNING id INTO s_id;
END;
$function$;