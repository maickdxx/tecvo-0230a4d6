-- =====================================================
-- RPC ATÔMICA: complete_service_with_payments
-- Garante atomicidade na conclusão de serviço + pagamentos
-- Previne race conditions e duplicação de transações
-- =====================================================

CREATE OR REPLACE FUNCTION public.complete_service_with_payments(
  _service_id uuid,
  _org_id uuid,
  _completed_date timestamptz DEFAULT now(),
  _payments jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _service record;
  _parcela record;
  _pm record;
  _net_amount numeric;
  _fee_amount numeric;
  _account_id uuid;
  _user_id uuid;
  _description text;
  _type_name text;
  _today text;
  _result jsonb;
BEGIN
  -- Validate org access
  PERFORM public.validate_org_access(_org_id);
  _user_id := auth.uid();
  _today := to_char(now() AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD');

  -- Lock the service row to prevent concurrent completion
  SELECT s.*, c.name as client_name
  INTO _service
  FROM public.services s
  LEFT JOIN public.clients c ON c.id = s.client_id
  WHERE s.id = _service_id
    AND s.organization_id = _org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado ou sem permissão';
  END IF;

  -- Prevent double-completion
  IF _service.status = 'completed' THEN
    RAISE EXCEPTION 'Serviço já está concluído';
  END IF;

  -- Get service type name
  SELECT name INTO _type_name
  FROM public.service_types
  WHERE slug = _service.service_type
    AND organization_id = _org_id
  LIMIT 1;
  
  _type_name := COALESCE(_type_name, _service.service_type);
  _description := _type_name || ' - ' || COALESCE(_service.client_name, 'Cliente');

  -- 1. Update service status
  UPDATE public.services
  SET status = 'completed',
      completed_date = _completed_date,
      updated_at = now()
  WHERE id = _service_id;

  -- 2. Delete any stale pending transactions
  DELETE FROM public.transactions
  WHERE service_id = _service_id
    AND status = 'pending';

  -- 3. Process payments
  IF jsonb_array_length(_payments) > 0 AND COALESCE(_service.value, 0) > 0 THEN
    FOR _parcela IN SELECT * FROM jsonb_to_recordset(_payments) AS x(
      payment_method text,
      amount numeric,
      financial_account_id text
    )
    LOOP
      -- Resolve payment method fees
      SELECT fee_type, fee_value, name, default_financial_account_id
      INTO _pm
      FROM public.payment_methods
      WHERE slug = _parcela.payment_method
        AND organization_id = _org_id
      LIMIT 1;

      _fee_amount := 0;
      _net_amount := _parcela.amount;

      IF _pm IS NOT NULL AND COALESCE(_pm.fee_value, 0) > 0 THEN
        IF _pm.fee_type = 'percentage' THEN
          _fee_amount := _parcela.amount * (_pm.fee_value / 100.0);
        ELSE
          _fee_amount := _pm.fee_value;
        END IF;
        _fee_amount := round(_fee_amount, 2);
        _net_amount := _parcela.amount - _fee_amount;
      END IF;

      _account_id := NULLIF(_parcela.financial_account_id, '')::uuid;
      IF _account_id IS NULL AND _pm IS NOT NULL THEN
        _account_id := _pm.default_financial_account_id;
      END IF;

      -- Insert service_payment (operational record)
      INSERT INTO public.service_payments (
        organization_id, service_id, payment_method, amount,
        financial_account_id, registered_by, is_confirmed
      ) VALUES (
        _org_id, _service_id, COALESCE(_parcela.payment_method, 'other'),
        _parcela.amount, _account_id, _user_id, false
      );

      -- Insert income transaction (net after fees)
      IF _net_amount > 0 THEN
        INSERT INTO public.transactions (
          organization_id, service_id, client_id, type, category,
          amount, description, date, due_date, status, payment_date,
          payment_method, financial_account_id
        ) VALUES (
          _org_id, _service_id, _service.client_id, 'income', 'service',
          _net_amount, _description, _today, _service.payment_due_date,
          'pending', null, _parcela.payment_method, _account_id
        );
      END IF;

      -- Insert fee expense if applicable
      IF _fee_amount > 0 THEN
        INSERT INTO public.transactions (
          organization_id, service_id, type, category,
          amount, description, date, status, payment_date
        ) VALUES (
          _org_id, _service_id, 'expense', 'taxa_pagamento',
          _fee_amount, 'Taxa ' || COALESCE(_pm.name, _parcela.payment_method) || ' - ' || COALESCE(_service.client_name, 'Cliente'),
          _today, 'paid', _today
        );
      END IF;
    END LOOP;
  END IF;

  _result := jsonb_build_object(
    'success', true,
    'service_id', _service_id,
    'status', 'completed'
  );

  RETURN _result;
END;
$$;