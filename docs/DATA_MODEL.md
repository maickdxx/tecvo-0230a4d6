# Modelo de Dados Central — Tecvo

## Entidade Central: `services`

| Campo Solicitado | Campo no Banco | Notas |
|-----------------|----------------|-------|
| id | `id` | UUID, PK |
| cliente_id | `client_id` | FK → `clients.id` |
| tecnico_id | `assigned_to` | UUID do técnico (perfil) |
| data_execucao | `scheduled_date` | Inclui data e hora |
| horario | `scheduled_date` | Parte hora do timestamp |
| tipo_servico | `service_type` | Enum: installation, maintenance, cleaning, repair |
| status | `status` | Enum: scheduled, in_progress, completed, cancelled |
| valor | `value` | Valor total do serviço |
| custo | via `transactions` (type=expense, service_id) | Custos vinculados ao serviço |
| forma_pagamento | `payment_method` | Slug da forma de pagamento |
| data_pagamento | `completed_date` / `payment_due_date` | Data de conclusão ou vencimento |
| criado_em | `created_at` | Timestamp de criação |
| atualizado_em | `updated_at` | Timestamp de última atualização |

---

## Consumo por Módulo

### Visão Geral (Dashboard)
```
services.status = 'completed' → receita realizada
services.value → soma de receitas
transactions.type = 'expense' → despesas
services.completed_date → fluxo de caixa real
```

### Agenda
```
services.scheduled_date → posicionamento no calendário
services.assigned_to → filtro por técnico
services.status → visual de estado
```

### Secretária IA
```
Leitura completa de: services, clients, transactions, profiles
Nunca altera dados — apenas sugere ações
```

---

## Regra Fundamental

> Todos os módulos consomem a mesma tabela `services`.  
> Nunca duplicar dados entre módulos.  
> Custos são registrados na tabela `transactions` com `service_id` como vínculo.
