-- Parte 1: Adicionar valor 'employee' ao enum e coluna assigned_to
ALTER TYPE app_role ADD VALUE 'employee';

-- Adicionar coluna assigned_to na tabela services
ALTER TABLE services ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);