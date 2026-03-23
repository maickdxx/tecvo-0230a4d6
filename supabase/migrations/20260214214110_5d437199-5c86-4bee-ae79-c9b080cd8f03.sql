
-- 1. Add parent_id column
ALTER TABLE public.transaction_categories
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.transaction_categories(id) ON DELETE CASCADE;

-- 2. Create temporary function to seed hierarchical categories for all organizations
CREATE OR REPLACE FUNCTION public._temp_seed_hierarchical_categories()
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  org RECORD;
  parent_uuid uuid;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP

    -- ==================== INCOME ====================

    -- Parent: Serviços
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Serviços', 'cat_servicos', 'income', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_servicos' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Instalação', 'instalacao', 'income', true, parent_uuid),
      (org.id, 'Manutenção preventiva', 'manutencao_preventiva', 'income', true, parent_uuid),
      (org.id, 'Manutenção corretiva', 'manutencao_corretiva', 'income', true, parent_uuid),
      (org.id, 'Limpeza', 'limpeza', 'income', true, parent_uuid),
      (org.id, 'Higienização', 'higienizacao', 'income', true, parent_uuid),
      (org.id, 'PMOC', 'pmoc', 'income', true, parent_uuid),
      (org.id, 'Visita técnica', 'visita_tecnica', 'income', true, parent_uuid),
      (org.id, 'Contrato recorrente', 'contrato_recorrente', 'income', true, parent_uuid),
      (org.id, 'Emergencial', 'emergencial', 'income', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Vendas
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Vendas', 'cat_vendas', 'income', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_vendas' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Venda de equipamento', 'venda_equipamento', 'income', true, parent_uuid),
      (org.id, 'Venda de peças', 'venda_pecas', 'income', true, parent_uuid),
      (org.id, 'Venda de acessórios', 'venda_acessorios', 'income', true, parent_uuid),
      (org.id, 'Materiais instalados', 'materiais_instalados', 'income', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Financeiro
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Financeiro', 'cat_financeiro', 'income', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_financeiro' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Taxa de visita', 'taxa_visita', 'income', true, parent_uuid),
      (org.id, 'Ajuste financeiro', 'ajuste_financeiro_income', 'income', true, parent_uuid),
      (org.id, 'Outras receitas', 'outras_receitas', 'income', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- ==================== EXPENSE ====================

    -- Parent: Operação
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Operação', 'cat_operacao', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_operacao' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Combustível', 'combustivel', 'expense', true, parent_uuid),
      (org.id, 'Pedágio', 'pedagio', 'expense', true, parent_uuid),
      (org.id, 'Estacionamento', 'estacionamento', 'expense', true, parent_uuid),
      (org.id, 'Manutenção de veículo', 'manutencao_veiculo', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Equipe
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Equipe', 'cat_equipe', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_equipe' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Salários', 'salarios', 'expense', true, parent_uuid),
      (org.id, 'Pró-labore', 'pro_labore', 'expense', true, parent_uuid),
      (org.id, 'Alimentação', 'alimentacao', 'expense', true, parent_uuid),
      (org.id, 'Ajuda de custo', 'ajuda_custo', 'expense', true, parent_uuid),
      (org.id, 'Comissão', 'comissao', 'expense', true, parent_uuid),
      (org.id, 'Terceirizados', 'terceirizados', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Materiais
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Materiais', 'cat_materiais', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_materiais' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Compra de peças', 'compra_pecas', 'expense', true, parent_uuid),
      (org.id, 'Compra de equipamentos', 'compra_equipamentos', 'expense', true, parent_uuid),
      (org.id, 'EPIs', 'epis', 'expense', true, parent_uuid),
      (org.id, 'Ferramentas', 'ferramentas', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Administrativo
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Administrativo', 'cat_administrativo', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_administrativo' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Aluguel', 'aluguel', 'expense', true, parent_uuid),
      (org.id, 'Água / Luz / Internet', 'agua_luz_internet', 'expense', true, parent_uuid),
      (org.id, 'Contabilidade', 'contabilidade', 'expense', true, parent_uuid),
      (org.id, 'Sistemas / Software', 'sistemas_software', 'expense', true, parent_uuid),
      (org.id, 'Marketing / Tráfego', 'marketing_trafego', 'expense', true, parent_uuid),
      (org.id, 'Telefonia', 'telefonia', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Fiscal e Bancário
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Fiscal e Bancário', 'cat_fiscal_bancario', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_fiscal_bancario' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Impostos', 'impostos', 'expense', true, parent_uuid),
      (org.id, 'Taxas bancárias', 'taxas_bancarias', 'expense', true, parent_uuid),
      (org.id, 'Taxas de cartão', 'taxas_cartao', 'expense', true, parent_uuid),
      (org.id, 'Juros / multas', 'juros_multas', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Parent: Outros
    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
    VALUES (org.id, 'Outros', 'cat_outros_expense', 'expense', true, NULL)
    ON CONFLICT (slug, organization_id) DO NOTHING;
    SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_outros_expense' AND organization_id = org.id;

    INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
      (org.id, 'Despesas diversas', 'despesas_diversas', 'expense', true, parent_uuid)
    ON CONFLICT (slug, organization_id) DO UPDATE SET parent_id = EXCLUDED.parent_id;

    -- Migrate old flat categories that match known slugs to their parent
    -- fuel -> combustivel parent
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_operacao' AND organization_id = org.id)
    WHERE slug = 'fuel' AND organization_id = org.id AND parent_id IS NULL;

    -- maintenance (expense) -> cat_operacao
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_materiais' AND organization_id = org.id)
    WHERE slug = 'maintenance' AND organization_id = org.id AND parent_id IS NULL AND type = 'expense';

    -- material -> cat_materiais
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_materiais' AND organization_id = org.id)
    WHERE slug = 'material' AND organization_id = org.id AND parent_id IS NULL;

    -- labor -> cat_equipe
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_equipe' AND organization_id = org.id)
    WHERE slug = 'labor' AND organization_id = org.id AND parent_id IS NULL;

    -- rent -> cat_administrativo
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_administrativo' AND organization_id = org.id)
    WHERE slug = 'rent' AND organization_id = org.id AND parent_id IS NULL;

    -- utilities -> cat_administrativo
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_administrativo' AND organization_id = org.id)
    WHERE slug = 'utilities' AND organization_id = org.id AND parent_id IS NULL;

    -- marketing -> cat_administrativo
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_administrativo' AND organization_id = org.id)
    WHERE slug = 'marketing' AND organization_id = org.id AND parent_id IS NULL;

    -- almoco -> cat_equipe
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_equipe' AND organization_id = org.id)
    WHERE slug = 'almoco' AND organization_id = org.id AND parent_id IS NULL;

    -- other_expense -> cat_outros_expense
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_outros_expense' AND organization_id = org.id)
    WHERE slug = 'other_expense' AND organization_id = org.id AND parent_id IS NULL;

    -- service (income) -> cat_servicos
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_servicos' AND organization_id = org.id)
    WHERE slug = 'service' AND organization_id = org.id AND parent_id IS NULL AND type = 'income';

    -- product (income) -> cat_vendas
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_vendas' AND organization_id = org.id)
    WHERE slug = 'product' AND organization_id = org.id AND parent_id IS NULL AND type = 'income';

    -- other_income -> cat_financeiro
    UPDATE public.transaction_categories SET parent_id = (SELECT id FROM public.transaction_categories WHERE slug = 'cat_financeiro' AND organization_id = org.id)
    WHERE slug = 'other_income' AND organization_id = org.id AND parent_id IS NULL AND type = 'income';

  END LOOP;
END;
$$;

-- 3. Execute the function
SELECT public._temp_seed_hierarchical_categories();

-- 4. Drop the temporary function
DROP FUNCTION public._temp_seed_hierarchical_categories();

-- 5. Update the initialize_default_types trigger to include hierarchy for new orgs
CREATE OR REPLACE FUNCTION public.initialize_default_types()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  parent_uuid uuid;
BEGIN
  -- Inserir tipos de serviço padrão
  INSERT INTO public.service_types (organization_id, name, slug, is_default) VALUES
    (NEW.id, 'Instalação', 'installation', true),
    (NEW.id, 'Manutenção', 'maintenance', true),
    (NEW.id, 'Limpeza', 'cleaning', true),
    (NEW.id, 'Reparo', 'repair', true);

  -- ==================== INCOME ====================
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Serviços', 'cat_servicos', 'income', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_servicos' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Instalação', 'instalacao', 'income', true, parent_uuid),
    (NEW.id, 'Manutenção preventiva', 'manutencao_preventiva', 'income', true, parent_uuid),
    (NEW.id, 'Manutenção corretiva', 'manutencao_corretiva', 'income', true, parent_uuid),
    (NEW.id, 'Limpeza', 'limpeza', 'income', true, parent_uuid),
    (NEW.id, 'Higienização', 'higienizacao', 'income', true, parent_uuid),
    (NEW.id, 'PMOC', 'pmoc', 'income', true, parent_uuid),
    (NEW.id, 'Visita técnica', 'visita_tecnica', 'income', true, parent_uuid),
    (NEW.id, 'Contrato recorrente', 'contrato_recorrente', 'income', true, parent_uuid),
    (NEW.id, 'Emergencial', 'emergencial', 'income', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Vendas', 'cat_vendas', 'income', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_vendas' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Venda de equipamento', 'venda_equipamento', 'income', true, parent_uuid),
    (NEW.id, 'Venda de peças', 'venda_pecas', 'income', true, parent_uuid),
    (NEW.id, 'Venda de acessórios', 'venda_acessorios', 'income', true, parent_uuid),
    (NEW.id, 'Materiais instalados', 'materiais_instalados', 'income', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Financeiro', 'cat_financeiro', 'income', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_financeiro' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Taxa de visita', 'taxa_visita', 'income', true, parent_uuid),
    (NEW.id, 'Ajuste financeiro', 'ajuste_financeiro_income', 'income', true, parent_uuid),
    (NEW.id, 'Outras receitas', 'outras_receitas', 'income', true, parent_uuid);

  -- ==================== EXPENSE ====================
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Operação', 'cat_operacao', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_operacao' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Combustível', 'combustivel', 'expense', true, parent_uuid),
    (NEW.id, 'Pedágio', 'pedagio', 'expense', true, parent_uuid),
    (NEW.id, 'Estacionamento', 'estacionamento', 'expense', true, parent_uuid),
    (NEW.id, 'Manutenção de veículo', 'manutencao_veiculo', 'expense', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Equipe', 'cat_equipe', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_equipe' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Salários', 'salarios', 'expense', true, parent_uuid),
    (NEW.id, 'Pró-labore', 'pro_labore', 'expense', true, parent_uuid),
    (NEW.id, 'Alimentação', 'alimentacao', 'expense', true, parent_uuid),
    (NEW.id, 'Ajuda de custo', 'ajuda_custo', 'expense', true, parent_uuid),
    (NEW.id, 'Comissão', 'comissao', 'expense', true, parent_uuid),
    (NEW.id, 'Terceirizados', 'terceirizados', 'expense', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Materiais', 'cat_materiais', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_materiais' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Compra de peças', 'compra_pecas', 'expense', true, parent_uuid),
    (NEW.id, 'Compra de equipamentos', 'compra_equipamentos', 'expense', true, parent_uuid),
    (NEW.id, 'EPIs', 'epis', 'expense', true, parent_uuid),
    (NEW.id, 'Ferramentas', 'ferramentas', 'expense', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Administrativo', 'cat_administrativo', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_administrativo' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Aluguel', 'aluguel', 'expense', true, parent_uuid),
    (NEW.id, 'Água / Luz / Internet', 'agua_luz_internet', 'expense', true, parent_uuid),
    (NEW.id, 'Contabilidade', 'contabilidade', 'expense', true, parent_uuid),
    (NEW.id, 'Sistemas / Software', 'sistemas_software', 'expense', true, parent_uuid),
    (NEW.id, 'Marketing / Tráfego', 'marketing_trafego', 'expense', true, parent_uuid),
    (NEW.id, 'Telefonia', 'telefonia', 'expense', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Fiscal e Bancário', 'cat_fiscal_bancario', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_fiscal_bancario' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Impostos', 'impostos', 'expense', true, parent_uuid),
    (NEW.id, 'Taxas bancárias', 'taxas_bancarias', 'expense', true, parent_uuid),
    (NEW.id, 'Taxas de cartão', 'taxas_cartao', 'expense', true, parent_uuid),
    (NEW.id, 'Juros / multas', 'juros_multas', 'expense', true, parent_uuid);

  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id)
  VALUES (NEW.id, 'Outros', 'cat_outros_expense', 'expense', true, NULL);
  SELECT id INTO parent_uuid FROM public.transaction_categories WHERE slug = 'cat_outros_expense' AND organization_id = NEW.id;
  INSERT INTO public.transaction_categories (organization_id, name, slug, type, is_default, parent_id) VALUES
    (NEW.id, 'Despesas diversas', 'despesas_diversas', 'expense', true, parent_uuid);

  RETURN NEW;
END;
$function$;
