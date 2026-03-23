# Política de Offline — Tecvo

## Princípio

O modo offline existe para **continuidade mínima de operação de campo**, não para espelhar o sistema no dispositivo.

## Permitido offline

- Registro de ponto (entrada, pausa, saída)
- Status operacional (a caminho, em atendimento)
- Agenda do dia previamente carregada (TTL curto)
- App shell (navegação base)

## Proibido cachear de forma persistente

- Dashboards e relatórios
- Listas de clientes, histórico de OS
- Uploads, imagens pesadas, logos
- Respostas dinâmicas volumosas
- Módulos administrativos (financeiro, configurações, WhatsApp)

## Regras de cache obrigatórias

Todo cache novo **deve** ter:

1. **Limite de entradas** (maxEntries)
2. **Expiração** (maxAgeSeconds ou TTL)
3. **Limite de tamanho por arquivo** (max 2 MB)

Storage total do app offline deve permanecer **abaixo de 10 MB** em uso normal.

## Requisito para novas funcionalidades offline

Qualquer adição ao escopo offline deve justificar:

- Valor operacional claro para técnico em campo
- Impacto estimado em storage
- Estratégia de limpeza/expiração
