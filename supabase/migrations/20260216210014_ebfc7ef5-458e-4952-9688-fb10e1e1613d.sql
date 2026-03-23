
-- 1. Insert missing default categories for ALL existing organizations
INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT o.id, 'Contratos', 'contratos', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types st WHERE st.organization_id = o.id AND st.slug = 'contratos'
);

INSERT INTO public.service_types (organization_id, name, slug, is_default)
SELECT o.id, 'Outros', 'outros', true
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.service_types st WHERE st.organization_id = o.id AND st.slug = 'outros'
);

-- 2. Rename existing default slugs to Portuguese for all orgs
UPDATE public.service_types SET slug = 'limpeza', name = 'Limpeza' WHERE slug = 'cleaning';
UPDATE public.service_types SET slug = 'instalacao', name = 'Instalação' WHERE slug = 'installation';
UPDATE public.service_types SET slug = 'manutencao', name = 'Manutenção' WHERE slug = 'maintenance';
UPDATE public.service_types SET slug = 'reparo', name = 'Reparo' WHERE slug = 'repair';

-- 3. Migrate catalog_services.service_type slugs
UPDATE public.catalog_services SET service_type = 'limpeza' WHERE service_type = 'cleaning';
UPDATE public.catalog_services SET service_type = 'instalacao' WHERE service_type = 'installation';
UPDATE public.catalog_services SET service_type = 'manutencao' WHERE service_type = 'maintenance';
UPDATE public.catalog_services SET service_type = 'contratos' WHERE service_type = 'maintenance_contract';
UPDATE public.catalog_services SET service_type = 'outros' WHERE service_type = 'other';
UPDATE public.catalog_services SET service_type = 'reparo' WHERE service_type = 'repair';

-- 4. Migrate services.service_type slugs (the enum allows these values already as text)
-- Note: services.service_type is an enum, so we need to handle this differently
-- We'll update the enum to support new values

-- 5. Set default for catalog_services.service_type
UPDATE public.catalog_services SET service_type = 'outros' WHERE service_type IS NULL OR service_type = '';
ALTER TABLE public.catalog_services ALTER COLUMN service_type SET DEFAULT 'outros';
ALTER TABLE public.catalog_services ALTER COLUMN service_type SET NOT NULL;

-- 6. Update the trigger function for new organizations
CREATE OR REPLACE FUNCTION public.initialize_default_types()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  parent_uuid uuid;
BEGIN
  -- Inserir tipos de serviço padrão (5 categorias)
  INSERT INTO public.service_types (organization_id, name, slug, is_default) VALUES
    (NEW.id, 'Instalação', 'instalacao', true),
    (NEW.id, 'Manutenção', 'manutencao', true),
    (NEW.id, 'Limpeza', 'limpeza', true),
    (NEW.id, 'Contratos', 'contratos', true),
    (NEW.id, 'Outros', 'outros', true);

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
