

## Problema

Quando o usuário registra uma transação (ex: "registra 100 reais em dinheiro"), a Laura sempre vincula à **conta padrão da IA** (Bradesco PJ), independente da forma de pagamento. Ela deveria perguntar qual conta usar quando existem múltiplas contas — e só pular a pergunta se houver apenas uma conta.

## Causa Raiz

1. A ferramenta `register_transaction` não aceita um parâmetro `account_id` — sempre usa `default_ai_account_id`
2. O prompt não instrui a Laura a perguntar a conta de destino antes de registrar
3. A lógica só pergunta qual conta usar quando não existe conta padrão definida — mas uma vez definida, nunca mais pergunta

## Plano de Correção

### 1. Adicionar parâmetro `account_id` à ferramenta `register_transaction`
**Arquivo:** `supabase/functions/_shared/lauraTools.ts`
- Adicionar propriedade opcional `account_id` (string, UUID da conta financeira)

### 2. Atualizar instrução do prompt para perguntar a conta
**Arquivo:** `supabase/functions/_shared/lauraPrompt.ts` (seção de instruções ~linha 878-892)
- Quando a organização tem **1 conta**: usar automaticamente, sem perguntar
- Quando tem **múltiplas contas**: Laura deve perguntar qual conta usar ANTES de registrar, listando as opções disponíveis do contexto (já visíveis em "CONTAS FINANCEIRAS")
- Incluir a conta na confirmação de resumo antes de executar

### 3. Atualizar handler de `register_transaction` para usar `account_id` do argumento
**Arquivo:** `supabase/functions/_shared/lauraPrompt.ts` (~linha 1124-1198)
- Se `args.account_id` foi fornecido e é válido (existe na org): usar esse
- Se não fornecido: usar `default_ai_account_id` como fallback
- Se múltiplas contas e nenhum `account_id` fornecido: retornar lista pedindo para a IA perguntar ao usuário

### Resultado Esperado
- 1 conta → registra direto sem perguntar
- Múltiplas contas → Laura pergunta "Em qual conta?" antes de registrar
- Conta escolhida aparece no resumo de confirmação

