# Módulo de transações financeiras (`transactions`)

> **Status da spec:** Aprovada e finalizada para implementação dos módulos `categories` e `transactions` no backend.

## Objetivo

Permitir que cada usuário autenticado registre, consulte, filtre, ordene, confirme e exclua logicamente suas receitas (`INCOME`) e despesas (`EXPENSE`), vinculadas a uma conta financeira (`accounts`) e opcionalmente a uma categoria (`categories`), mantendo isolamento estrito por usuário (proteção contra IDOR), precisão decimal no PostgreSQL e atualização consistente do saldo das contas.

## Escopo

### Incluído nesta etapa (`transactions` + referência base de `categories`)

- Modelagem da tabela `transactions` e dos enums `TransactionType` (`INCOME`, `EXPENSE`) e `TransactionStatus` (`CONFIRMED`, `PENDING`) no PostgreSQL via Prisma;
- Integração direta com `CategoriesService` (para validar existência/acesso/status quando `categoryId` for informado, sem gateway ou interface intermediária) e `AccountsService` (para validar conta ativa do usuário e atualizar saldo atomicamente);
- Camadas do módulo `backend/src/modules/transactions/` seguindo o mesmo padrão modular de `accounts` (`domain`, `application`, `infrastructure`, `presentation`);
- Operações HTTP versionadas sob `/api/v1/transactions`:
  - Lançar receita ou despesa (`POST /api/v1/transactions`);
  - Listar transações com paginação global, filtros (`status`, `type`, `accountId`, `categoryId`, intervalo `dateFrom`/`dateTo`, busca textual) e ordenação (`transactionDate`, `amount`);
  - Buscar transação por ID (`GET /api/v1/transactions/:transactionId`);
  - Confirmar transação pendente (`PATCH /api/v1/transactions/:transactionId/confirm`);
  - Excluir transação logicamente via `deletedAt` (`DELETE /api/v1/transactions/:transactionId`);
- Atualização de `PrismaAccountRepository.countLinkedTransactions` para considerar transações não excluídas (`deleted_at IS NULL`).

### Fora do escopo desta etapa (etapas futuras)

- Campos e regras de recorrência (`scheduledDate`, `recurringRuleId`, controle de duplicidade por ocorrência) — reservados para o módulo `recurring-transactions`;
- Edição de dados financeiros após a criação (conforme regra do domínio em `docs/Gerenciador de Finanças - Minha Carteira.md`, transações criadas não são editadas; apenas confirmadas ou excluídas logicamente);
- Endpoints agregados de dashboard mensal e gráficos por competência (`dashboard`).

## Decisões confirmadas

1. **Separação explícita entre `type` e `categoryId` (opcional):**
   - `type`: obrigatório (`TransactionType`: `INCOME` | `EXPENSE`). Define a direção financeira do lançamento (entrada ou saída).
   - `categoryId`: **opcional** (`@db.Uuid?`), referenciando a tabela `categories` no PostgreSQL (detalhada em `backend/.specs/features/categories/`). Quando informado, `TransactionsService` valida a categoria diretamente via `CategoriesService` (existência, acesso por `isDefault = true` ou `userId` e `status = ACTIVE`), sem criar gateway ou interface adicional. Como `categories` não possui `type`, qualquer categoria ativa acessível ao usuário pode ser vinculada à transação.
2. **Estrutura base de `categories` para integridade referencial:**
   - `categories` possui especificação própria em `backend/.specs/features/categories/` (`id`, `userId?`, `name`, `color?`, `icon?`, `isDefault`, `status` `ACTIVE`/`INACTIVE`, `createdAt`, `updatedAt`, sem `type` e sem `deletedAt`).
3. **Observações padronizadas em `notes`:**
   - Campo opcional `notes` (`String?`), alinhado ao frontend e à documentação geral do projeto (sem usar `observations`).
4. **Data financeira em `transactionDate`:**
   - Campo obrigatório `transactionDate` (`@db.Date`, formato civil `YYYY-MM-DD`) representando a data efetiva/prevista da movimentação, separada da auditoria `createdAt`.
5. **Estratégia para lançamentos futuros e confirmação (Opção A):**
   - `status` aceita apenas `CONFIRMED` e `PENDING` (`TransactionStatus`).
   - Lançamentos futuros usam `transactionDate` com `status = PENDING`.
   - `confirmedAt` (`DateTime?`) opcional registra o timestamp de quando um lançamento `PENDING` passa para `CONFIRMED`.
   - **Sem `settleAt`, `scheduledDate` ou `recurringRuleId` nesta etapa:** os campos específicos de agendamento recorrente serão adicionados somente quando o módulo `recurring-transactions` for especificado e implementado.
6. **Precisão monetária e impacto em saldo (`accounts.currentBalance`):**
   - `amount` persistido com `@db.Decimal(14, 2)` e restrição `amount > 0` no banco (o sinal é determinado por `type`).
   - Apenas transações `CONFIRMED` (e não excluídas) impactam `accounts.current_balance`.
   - Transações `PENDING` não alteram o saldo até serem confirmadas.
   - Ao confirmar uma transação `PENDING` ou excluir logicamente uma transação `CONFIRMED`, o saldo da conta é atualizado atomicamente na mesma transação do banco.
7. **Exclusão lógica e auditoria:**
   - Colunas `createdAt`, `updatedAt` e `deletedAt DateTime?`.
   - FKs `accountId` e `categoryId` com `onDelete: Restrict`; `userId` com `onDelete: Cascade`.
8. **Imutabilidade, confirmação e contratos globais:**
   - Lançamentos criados **não são editáveis** via `PATCH`; para corrigir dados financeiros, a transação deve ser excluída logicamente (`DELETE`) e relançada (`POST`).
   - `PATCH /api/v1/transactions/:transactionId/confirm` confirma tanto receitas (`INCOME`) quanto despesas (`EXPENSE`) que estejam com `status = PENDING` (validando sempre o status atual antes de confirmar).
   - Autenticação via `createAuthenticationMiddleware`, proteção CSRF via `createCsrfValidationMiddleware` e isolamento estrito por `{ id, userId }` (anti-IDOR).
   - Reutilização integral de `pagination.ts`, `success-response.ts` e `app-error.ts`, retornando em `meta` o resumo consolidado dos filtros (`totalIncome`, `totalExpense`, `netResult`, `pendingIncomeAmount`, `pendingIncomeCount`) junto aos metadados de paginação.

## Critérios de aceite (para a etapa de implementação)

- [ ] Schema Prisma e migration (`UP`/`DOWN`) válidos com `yarn prisma:validate` e `yarn prisma:generate`.
- [ ] Camada de domínio pura sem dependências de Prisma ou Express.
- [ ] Saldo da conta atualizado atomicamente ao criar/confirmar transação `CONFIRMED` ou excluir logicamente transação `CONFIRMED`.
- [ ] Filtros por `status`, `accountId`, `categoryId`, `transactionDate` (`dateFrom`/`dateTo`) e ordenação por data ou valor funcionando com paginação global.
- [ ] Testes unitários e HTTP cobrindo criação, confirmação, exclusão lógica, filtros, ordenação e proteção contra IDOR.
