-- 1. Alterar tipo da coluna category de enum para text
ALTER TABLE transactions 
  ALTER COLUMN category TYPE text 
  USING category::text;

-- 2. Adicionar coluna para tipo de fonte do pagamento (supplier ou employee)
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS payment_source_type text;

-- 3. Adicionar coluna para referência de funcionário
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS employee_id uuid;

-- 4. Inserir novas categorias de despesas para todas as organizações
INSERT INTO transaction_categories (organization_id, name, slug, type, is_default)
SELECT 
  o.id as organization_id,
  cat.name,
  cat.slug,
  'expense' as type,
  true as is_default
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Salário', 'salario'),
    ('Impostos', 'impostos'),
    ('Contas (Água/Luz/Internet)', 'contas_utilidades')
) AS cat(name, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_categories tc 
  WHERE tc.organization_id = o.id AND tc.slug = cat.slug
);

-- 5. Inserir novas categorias de receitas para todas as organizações
INSERT INTO transaction_categories (organization_id, name, slug, type, is_default)
SELECT 
  o.id as organization_id,
  cat.name,
  cat.slug,
  'income' as type,
  true as is_default
FROM organizations o
CROSS JOIN (
  VALUES 
    ('Instalação', 'instalacao'),
    ('Limpeza', 'limpeza_receita'),
    ('Manutenção', 'manutencao_receita'),
    ('Contrato Recorrente', 'contrato_recorrente')
) AS cat(name, slug)
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_categories tc 
  WHERE tc.organization_id = o.id AND tc.slug = cat.slug
);