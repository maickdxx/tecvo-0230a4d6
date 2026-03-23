/*
  # Adicionar tabela de logs de auditoria

  1. Novas Tabelas
    - `audit_logs`
      - `id` (uuid, chave primária)
      - `action` (text) - Descrição da ação
      - `user_id` (uuid) - Usuário que realizou a ação
      - `organization_id` (uuid, nullable) - Organização relacionada
      - `metadata` (jsonb) - Dados adicionais da ação
      - `created_at` (timestamptz) - Data e hora da ação

  2. Funções
    - `count_technicians()` - Função para contar total de técnicos

  3. Segurança
    - Enable RLS na tabela `audit_logs`
    - Apenas super admins podem ler logs
*/

-- Criar tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política: Apenas super admins podem ler logs
CREATE POLICY "Super admins can read all audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'super_admin'
    )
  );

-- Função para contar técnicos
CREATE OR REPLACE FUNCTION count_technicians()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(DISTINCT p.id)
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id
  WHERE ur.role = 'employee';
$$;
