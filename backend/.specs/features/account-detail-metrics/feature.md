# Métricas de detalhes da conta (`GET /api/v1/accounts/:accountId`)

> **Status da spec:** Proposta pronta para revisão e implementação no módulo `accounts` do backend.

## Objetivo

Enriquecer exclusivamente a rota `GET /api/v1/accounts/:accountId` para retornar, em uma única requisição, as métricas financeiras mensais, a série comparativa dos últimos 6 meses e a distribuição de gastos por categoria usadas na página de detalhes da conta no frontend (`account-detail-view.tsx`), filtradas por mês/ano enviados via query string.

## Escopo

### Incluído nesta etapa (`account-detail-metrics`)

- Adição de parâmetro opcional de competência na URL de `GET /api/v1/accounts/:accountId` (ex.: `?month=11/2026`);
- Novo DTO de saída `AccountDetailResponseDto` estendendo `AccountResponseDto` com o bloco `metrics`;
- Cálculo no backend (via repositório Prisma sobre `transactions` e `categories` existentes) de:
  - Resumo do mês consultado: `income`, `expense`, `netResult`, `projectedBalance` e `pending` (`count`, `amount`, `incomeAmount`, `expenseAmount`);
  - Série histórica de 6 meses (`monthlySeries`, encerrando na competência consultada) com `income` e `expense` confirmados;
  - Distribuição de despesas confirmadas por categoria no mês (`categorySpend`), com percentual calculado sobre o total de despesas do mês;
- Validação da query com Zod (`400 VALIDATION_ERROR` para formatos ou meses inválidos) e testes unitários/HTTP cobrindo o novo contrato.

### Fora do escopo desta etapa

- Alteração da listagem `GET /api/v1/accounts`, `POST /api/v1/accounts`, `PATCH /api/v1/accounts/:accountId`, `/deactivate` ou `/reactivate` — essas rotas permanecem retornando `AccountResponseDto`;
- Alterações no schema do PostgreSQL ou criação de migrations Prisma (as tabelas `accounts`, `transactions` e `categories` já possuem os dados e índices necessários);
- Listagem paginada de transações da conta dentro desta rota — a tabela de movimentações continua sendo consumida via `GET /api/v1/transactions?accountId=:accountId`.

## Decisões de negócio e contrato

1. **Parâmetro de competência (`month`):**
   - Query param opcional: `?month=11/2026` (`MM/YYYY`) — aceitando também `YYYY-MM` (`2026-11`) e normalizando internamente para competência civil (`year`, `month`).
   - Quando omitido, assume automaticamente o mês e o ano correntes do servidor no formato `MM/YYYY`.
   - Regras de validação: mês entre `01` e `12`, ano entre `1900` e `2100`; parâmetros desconhecidos na query são rejeitados (`.strict()`).

2. **Critério de status das transações:**
   - Sempre ignorar registros com exclusão lógica (`deletedAt IS NOT NULL`) e restringir estritamente por `userId` e `accountId` (anti-IDOR).
   - **Valores realizados (`income`, `expense`, `netResult`, `monthlySeries` e `categorySpend`):** consideram apenas transações com `status = CONFIRMED` cuja `transactionDate` esteja no intervalo correspondente.
   - **Pendências (`pending`):** consideram apenas transações com `status = PENDING` cuja `transactionDate` esteja dentro do mês consultado:
     - `pending.count`: quantidade total de transações pendentes no mês (receitas + despesas);
     - `pending.incomeAmount`: soma das receitas (`INCOME`) pendentes no mês;
     - `pending.expenseAmount`: soma das despesas (`EXPENSE`) pendentes no mês;
     - `pending.amount`: `pending.incomeAmount + pending.expenseAmount` (volume financeiro total pendente no mês).

3. **Saldo projetado (`projectedBalance`):**
   - Calculado como `currentBalance + pending.incomeAmount - pending.expenseAmount`, arredondado para 2 casas decimais.

4. **Série dos últimos 6 meses (`monthlySeries`):**
   - Sempre retorna exatamente 6 itens em ordem cronológica crescente, do mês `(competência - 5 meses)` até o mês consultado.
   - Meses sem movimentação são preenchidos com `income: 0` e `expense: 0`.
   - `month` no formato `"MM/YYYY"` (ex.: `"11/2026"`) e `label` abreviado em português (`"Nov/2026"`).

5. **Gastos por categoria (`categorySpend`):**
   - Considera despesas (`type = EXPENSE`, `status = CONFIRMED`) do mês consultado agrupadas por `categoryId`.
   - Despesas sem categoria (`categoryId = null`) são agrupadas sob `{ categoryId: null, name: "Sem categoria", color: null, icon: null }`.
   - Ordenação por `amount` decrescente (desempate alfabético por `name`).
   - `percentage` calculado com 1 casa decimal sobre a soma total das despesas do mês (`0` caso o total seja `0`).

## Critérios de aceite

- [ ] `GET /api/v1/accounts/:accountId` sem query param usa o mês/ano atual e retorna `metrics` completo dentro do envelope padrão `sendSuccess`.
- [ ] `GET /api/v1/accounts/:accountId?month=11/2026` (ou `11%2F2026`) calcula todos os valores exatamente para `01/11/2026`–`30/11/2026` e a janela de 6 meses de `06/2026` a `11/2026`.
- [ ] Parâmetro `month` inválido (ex.: `13/2026`, `abc`, `2026-00`) retorna `400 VALIDATION_ERROR` em português brasileiro.
- [ ] Transações excluídas (`deletedAt != null`) ou de outros usuários/contas nunca entram nos cálculos.
- [ ] Demais rotas de `accounts` (`GET /accounts`, `POST`, `PATCH`, `DELETE`) não sofrem quebra de contrato.
