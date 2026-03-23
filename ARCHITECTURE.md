# Arquitetura Definitiva — Tecvo

## 3 Pilares

| Pilar | Função | Dados Principais |
|-------|--------|-----------------|
| **Visão Geral** | Inteligência Financeira | `value`, `status`, `completed_date`, `payment_method` |
| **Agenda** | Execução Operacional | `scheduled_date`, `assigned_to`, `status` |
| **Secretária IA** | Inteligência Estratégica | Leitura de todos os dados (nunca altera automaticamente) |

Nenhum módulo sobrescreve outro. Todos consomem a mesma entidade central (`services`).

---

## Regras de Desenvolvimento

### Estrutura Fixa da Plataforma (Base Oficial)

A estrutura de módulos, menus e navegação é considerada **base fixa e oficial**. Inclui todos os módulos principais: Dashboard, Agenda, Financeiro, Ordens de Serviço, Clientes/CRM, WhatsApp/Conversas, Configurações, Relatórios, Meu Dia, Secretária IA, Catálogo de Serviços, Fornecedores, Lixeira, Tutorial, Suporte, Atualizações, Recorrência, Orçamentos, e todos os demais módulos existentes.

**Regras obrigatórias:**
- ❌ **NÃO** alterar menus ou navegação (Sidebar, MobileNav, rotas)
- ❌ **NÃO** mudar a organização dos módulos
- ❌ **NÃO** remover páginas
- ❌ **NÃO** reorganizar a navegação
- ❌ **NÃO** alterar a arquitetura de módulos existente
- ✅ Melhorias **internas** dentro das páginas podem ser feitas normalmente (layout, campos, funcionalidades internas)
- ✅ Novos módulos ou exclusão de módulos **somente com autorização explícita do usuário**
- ⚠️ Se algo novo impactar a estrutura, **informar antes de alterar**

### Proibições Gerais

- ❌ Apagar funcionalidades existentes
- ❌ Alterar regras ou cálculos já implementados
- ❌ Modificar lógica de páginas já aprovadas
- ❌ Reestruturar banco de dados sem necessidade
- ❌ Reescrever telas inteiras ao adicionar novas funções
- ❌ Alterar nomes de campos existentes

### Obrigações

- ✅ Trabalhar por **extensão** (novos componentes, não editar existentes)
- ✅ Trabalhar por **módulo** (componentes isolados e independentes)
- ✅ Trabalhar **sem regressão** (preservar 100% do que já funciona)
- ✅ Se algo precisar ser alterado, **perguntar antes**

### Proteção Contra Regressão

Antes de qualquer atualização:

1. Comparar estrutura atual com a nova
2. Garantir que nenhuma função foi removida
3. Garantir que nenhum cálculo foi alterado
4. Garantir que nenhuma rota foi apagada

Se houver conflito: **parar e sinalizar**.

---

## Padrão de Evolução

- Camadas isoladas
- Componentes independentes
- Lógica reutilizável
- Banco central único (`services`)
- Sem reescrever o sistema a cada melhoria

---

## Regras por Módulo

### Visão Geral
- Usa `completed_date` (não `created_at`) para receita realizada
- Usa `value` para soma de receitas
- Usa `transactions` (type=expense) para custos
- Usa `payment_due_date` / `completed_date` para fluxo de caixa

### Agenda
- Usa exclusivamente `scheduled_date`, `assigned_to`, `status`
- Não faz cálculo financeiro
- Apenas organiza execução

### Secretária IA
- Acessa todos os dados em modo leitura
- Nunca altera dados automaticamente
- Sempre sugere ações com confirmação do usuário
