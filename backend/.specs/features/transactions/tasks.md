# Módulo de transações financeiras (`transactions`) — Plano de tarefas

## Objetivo
Implementar o módulo completo de `transactions` no backend (persistência Prisma, domínio, aplicação consumindo `CategoriesService` e `AccountsService`, apresentação sob `/api/v1/transactions`, integração com `countLinkedTransactions` em `accounts` e testes), seguindo os contratos globais do projeto.

## Restrições globais
- Reutilizar obrigatoriamente os contratos globais em `backend/src/shared/`: `parsePagination` e `createPaginationMeta` (`pagination.ts`), `sendSuccess`, `sendCreated` e `sendNoContent` (`success-response.ts`), `AppError` e `ErrorCode` (`app-error.ts`) e middlewares de autenticação e CSRF (`auth`).
- **Imutabilidade pós-criação:** não existe `PATCH` de edição financeira; apenas `POST`, `GET` (lista com filtros na URL e paginação + resumo em `meta`), `GET /:transactionId`, `PATCH /:transactionId/confirm` e `DELETE /:transactionId` (exclusão lógica via `deletedAt`).
- `categoryId` é **opcional** na transação; quando informado, `TransactionsService` valida existência, acesso e `status = ACTIVE` diretamente via `CategoriesService` (sem criar gateway nem interface intermediária).
- `scheduledDate` e `recurringRuleId` **não** entram nesta etapa.
- Seguir `backend/.specs/README.md` para migrations e `AGENTS.md` (mensagens de erro, comentários e logs em português brasileiro; Yarn 4 dentro de `backend/`).
- Sempre ler `feature.md` e `sdd.md` antes de executar as tasks e marcar `[x]` conforme concluir cada passo.
- Não fazer commits antes de revisão

---

## Task 1: Schema Prisma, migration (UP/DOWN) e scripts de manutenção

**Arquivos:**
- Modificar:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/scripts/data/demo-data.ts`
  - `backend/prisma/scripts/database-maintenance.ts`
  - `backend/prisma/scripts/seed/seed.ts`
- Criar:
  - `backend/prisma/migrations/<timestamp>_create_transactions_table/migration.sql`
  - `backend/prisma/migrations/<timestamp>_create_transactions_table/down.sql`

**Passos:**
- [x] Adicionar `TransactionType` (`INCOME`, `EXPENSE`), `TransactionStatus` (`CONFIRMED`, `PENDING`) e o model `Transaction` mapeado para `transactions` (`id`, `user_id`, `account_id`, `category_id?`, `description`, `amount` `@db.Decimal(14, 2)`, `type`, `status`, `transaction_date` `@db.Date`, `notes?`, `confirmed_at?`, `created_at`, `updated_at`, `deleted_at?`) em `backend/prisma/schema.prisma`.
- [x] Configurar `User` (`onDelete: Cascade`), `Account` (`onDelete: Restrict`) e `Category?` (`onDelete: Restrict`), além dos índices compostos iniciando por `userId` (`user_id`) e `deletedAt` (`deleted_at`).
- [x] Criar `migration.sql` dentro de `BEGIN; ... COMMIT;` com DDL, `CHECK` constraints (`amount > 0`, `char_length(btrim(description)) >= 2`) e registro idempotente em `"_prisma_migrations"`.
- [x] Criar `down.sql` removendo índices, tabela `transactions`, enums e registro em `"_prisma_migrations"`.
- [x] Atualizar scripts de seed/manutenção para incluir transações de exemplo e limpeza segura.
- [x] Executar `yarn prisma:validate` e `yarn prisma:generate` em `backend/` *(validação em banco PostgreSQL real pendente de execução de migration em ambiente dedicado)*.

**Commit sugerido:**
`feat(transactions): add transactions table schema and migration`

---

## Task 2: Domínio de `transactions` (enums, entidade e interfaces)

**Arquivos:**
- Criar:
  - `backend/src/modules/transactions/domain/enums/transaction.enums.ts`
  - `backend/src/modules/transactions/domain/entities/transaction.entity.ts`
  - `backend/src/modules/transactions/domain/interfaces/transaction.interfaces.ts`
  - `backend/src/modules/transactions/domain/interfaces/transaction-repository.interface.ts`

**Passos:**
- [x] Criar `TransactionType` e `TransactionStatus` em `transaction.enums.ts`.
- [x] Implementar a entidade `Transaction` validando `description` (2–120 chars após `trim`), `amount > 0` até o limite decimal `999_999_999_999.99` (2 casas decimais), `transactionDate` válido (`YYYY-MM-DD`), `notes?` (até 500 chars) e transições `confirm()` (somente `PENDING` → `CONFIRMED`) e `softDelete()`.
- [x] Definir filtros (`status`, `type`, `accountId`, `categoryId`, `dateFrom`, `dateTo`, `search`), ordenação (`transactionDate`, `amount`), `TransactionListSummary` e `PaginatedTransactionsResult` em `transaction.interfaces.ts`.
- [x] Definir `ITransactionRepository` isolada em `transaction-repository.interface.ts` (sem Prisma ou Express).

**Commit sugerido:**
`feat(transactions): add transaction domain entity, enums and repository interface`

---

## Task 3: Aplicação (`dto`, `mapper`, `service`), repositório Prisma e integração com `accounts`

**Arquivos:**
- Criar:
  - `backend/src/modules/transactions/application/dto/transaction.dto.ts`
  - `backend/src/modules/transactions/application/mappers/transaction.mapper.ts`
  - `backend/src/modules/transactions/application/services/transactions.service.ts`
  - `backend/src/modules/transactions/infrastructure/repositories/prisma-transaction.repository.ts`
  - `backend/src/modules/transactions/index.ts`
- Modificar:
  - `backend/src/modules/accounts/infrastructure/repositories/prisma-account.repository.ts`
  - `backend/src/modules/categories/infrastructure/repositories/prisma-category.repository.ts`

**Passos:**
- [x] Criar DTOs de entrada/saída (`CreateTransactionDto`, `ListTransactionsQueryDto`, `TransactionResponseDto`, `TransactionListMetaSummaryDto`).
- [x] Implementar `TransactionMapper` para conversão Prisma ↔ domínio ↔ DTO.
- [x] Implementar `TransactionsService` injetando `AccountsService` (validar conta ativa do usuário) e `CategoriesService` (quando `categoryId` for informado, buscar por ID e validar acesso e `status = ACTIVE`).
- [x] Implementar `PrismaTransactionRepository` com `$transaction` para atualização atômica de `accounts.current_balance` na criação `CONFIRMED`, confirmação (`PENDING` → `CONFIRMED`) e exclusão lógica (`deletedAt`) de transação `CONFIRMED`, além de consulta paginada com filtros, ordenação e cálculo dos totais do filtro atual.
- [x] Atualizar `countLinkedTransactions` em `PrismaAccountRepository` e `PrismaCategoryRepository` para contar transações não excluídas (`deleted_at IS NULL`) e tratar `P2003` como `409 Conflict` na exclusão física.

**Commit sugerido:**
`feat(transactions): add transactions service, repository and atomic balance updates`

---

## Task 4: Apresentação (`schemas`, `controller`, `routes`) e composição

**Arquivos:**
- Criar:
  - `backend/src/modules/transactions/presentation/schemas/transactions.schemas.ts`
  - `backend/src/modules/transactions/presentation/controllers/transactions.controller.ts`
  - `backend/src/modules/transactions/presentation/routes/transactions.routes.ts`
- Modificar:
  - `backend/src/app/app.ts`
  - `backend/src/app/compositon-root.ts`

**Passos:**
- [x] Criar schemas Zod para criação (`POST`), query de filtros/paginação/ordenação na URL (`GET`) e parâmetro `:transactionId`.
- [x] Implementar `TransactionsController` reutilizando `parsePagination`, `createPaginationMeta` (acrescentando o resumo consolidado em `meta`), `sendSuccess`, `sendCreated`, `sendNoContent` e `AppError`.
- [x] Configurar `transactions.routes.ts` (`POST /`, `GET /`, `GET /:transactionId`, `PATCH /:transactionId/confirm`, `DELETE /:transactionId`) com `createAuthenticationMiddleware` e `createCsrfValidationMiddleware`.
- [x] Registrar `transactionsRouter` sob `/api/v1/transactions` no composition root e em `app.ts`, conectando `CategoriesService` e `AccountsService`.

**Commit sugerido:**
`feat(transactions): expose versioned transactions http routes and controller`

---

## Task 5: Testes unitários e HTTP do módulo `transactions`

**Arquivos:**
- Criar:
  - `backend/test/transactions/transaction.entity.test.ts`
  - `backend/test/transactions/transactions.service.test.ts`
  - `backend/test/transactions/transactions.routes.test.ts`

**Passos:**
- [x] Cobrir invariantes da entidade `Transaction` (`amount > 0` até `999_999_999_999.99`, `confirm()` apenas em `PENDING`, `softDelete()`).
- [x] Cobrir `TransactionsService` (criação com e sem `categoryId`, validação via `CategoriesService`, erro em categoria inativa/inexistente, atualização atômica de saldo na criação/confirmação/exclusão, filtros e ordenação, proteção anti-IDOR).
- [x] Cobrir rotas HTTP (`/api/v1/transactions`), incluindo `PATCH /:transactionId/confirm` para `INCOME` e `EXPENSE` e erro quando já `CONFIRMED`.
- [x] Executar testes de `transactions` (`yarn exec tsx --test test/transactions/*.test.ts`) e checagem de tipos (`yarn exec tsc --noEmit`) em `backend/`.

**Commit sugerido:**
`test(transactions): add unit and http tests for transactions module`
