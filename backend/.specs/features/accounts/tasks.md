# Módulo de contas financeiras (`accounts`) — Plano de tarefas

## Objetivo
Implementar a estrutura base completa do módulo `accounts` no backend (persistência Prisma, domínio, aplicação, apresentação sob `/api/v1/accounts` e testes), de forma independente do módulo `transactions` e totalmente alinhada aos contratos globais do projeto e à UI já construída no frontend.

## Restrições globais
- Reutilizar obrigatoriamente os contratos globais em `backend/src/shared/`: `parsePagination` e `createPaginationMeta` (`pagination.ts`), `sendSuccess`, `sendCreated` e `sendNoContent` (`success-response.ts`), `AppError` e `ErrorCode` (`app-error.ts`) e os middlewares de autenticação e CSRF (`auth`). Não duplicar nem sobrescrever contratos globais.
- Toda exclusão de conta é **exclusão física real** (sem soft delete / `deletedAt`), com verificação preparatória para bloquear (`409 Conflict`) quando existirem lançamentos após a criação de `transactions`.
- Seguir `backend/.specs/README.md` para criação de migrations (`BEGIN; ... COMMIT;`, `_prisma_migrations` idempotente, `down.sql` e atualização de `backend/prisma/scripts/`).
- Respeitar `AGENTS.md`: mensagens de erro, comentários de código e logs em português brasileiro; identificadores e mensagens de commit em inglês (Conventional Commits); Yarn 4 dentro de `backend/`.
- Fazer tasks por grupo e sempre atualizar a caixinha das task marcando um X nas tasks feitas
- Nunca fazer commit antes de revisão  update tasks status on email mfa spec
- Sempre leia `feature.md` e `sdd.md` antes de realizar as tasks

---

## Task 1: Schema Prisma, migration (UP/DOWN) e scripts de manutenção

**Arquivos:**
- Modificar:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/scripts/data/demo-data.ts`
  - `backend/prisma/scripts/database-maintenance.ts`
  - `backend/prisma/scripts/seed/seed.ts`
- Conferido (sem necessidade de alteração, delega para `database-maintenance.ts`):
  - `backend/prisma/scripts/reset/reset.ts`
- Criar:
  - `backend/prisma/migrations/20261115161500_create_accounts_table/migration.sql`
  - `backend/prisma/migrations/20261115161500_create_accounts_table/down.sql`

**Passos:**
- [x] Adicionar `AccountType` (`CHECKING`, `CASH`, `DIGITAL`, `SAVINGS`, `INVESTMENT`), `AccountStatus` (`ACTIVE`, `INACTIVE`), o model `Account` (`@db.Decimal(14, 2)` em `initialBalance`/`currentBalance`, `brand?`, `institution?`, `color?`, `inactivatedAt?`) e relação `User -> Account` (`onDelete: Cascade`) em `backend/prisma/schema.prisma`.
- [x] Adicionar índices compostos `[userId, status]`, `[userId, type, status]` e `[userId, inactivatedAt]`.
- [x] Criar `migration.sql` dentro de `BEGIN; ... COMMIT;` contendo DDL da tabela, `CHECK` constraints (`initial_balance >= 0`, coerência de `status`/`inactivated_at`, `color` `#RRGGBB`), **índice único parcial** `CREATE UNIQUE INDEX "accounts_user_id_active_name_key" ON "accounts" ("user_id", lower(btrim("name"))) WHERE "status" = 'ACTIVE'`, registro idempotente em `"_prisma_migrations"` e comentário referenciando `down.sql`.
- [x] Criar `down.sql` removendo índices, tabela `accounts`, enums e o registro em `"_prisma_migrations"`.
- [x] Atualizar `demo-data.ts`, `database-maintenance.ts` e `seed.ts` (e conferir `reset.ts`) para incluir contas de exemplo no seed e inclusão de `accounts` na limpeza segura.
- [x] Executar `yarn prisma:validate` e `yarn prisma:generate` em `backend/`.

**Pronto quando:**
- `yarn prisma:validate` e `yarn prisma:generate` concluem sem erros e os scripts de seed/reset refletem o novo schema.

**Commit sugerido:**
`feat(accounts): add accounts table schema and migration`

---

## Task 2: Domínio de `accounts` (enums, entidade e interfaces)

**Arquivos:**
- Criar:
  - `backend/src/modules/accounts/domain/enums/account.enums.ts`
  - `backend/src/modules/accounts/domain/entities/account.entity.ts`
  - `backend/src/modules/accounts/domain/interfaces/account.interfaces.ts`
  - `backend/src/modules/accounts/domain/interfaces/account-repository.interface.ts`

**Passos:**
- [x] Criar `AccountType` e `AccountStatus` em `account.enums.ts`.
- [x] Implementar a entidade `Account` validando `name` (2–80 chars após `trim`), `initialBalance >= 0` (2 casas decimais), `currentBalance = initialBalance` na criação, normalização de `brand`/`institution`, formato `#RRGGBB` para `color` e transições `updateDetails`, `deactivate` e `reactivate`.
- [x] Definir `AccountFilter`, `AccountPaginationQuery`, `AccountListSummary` e `PaginatedAccountsResult` em `account.interfaces.ts`.
- [x] Definir `IAccountRepository` isolada em `account-repository.interface.ts` (sem importar Prisma ou Express), incluindo `countLinkedTransactions` preparatório.

**Pronto quando:**
- A camada `domain/` compila em TypeScript estrito sem dependências externas e todas as invariantes da entidade estão cobertas por testes unitários.

**Commit sugerido:**
`feat(accounts): add account domain entity, enums and repository interface`

---

## Task 3: Aplicação (`dto`, `mapper`, `service`) e repositório Prisma

**Arquivos:**
- Criar:
  - `backend/src/modules/accounts/application/dto/account.dto.ts`
  - `backend/src/modules/accounts/application/mappers/account.mapper.ts`
  - `backend/src/modules/accounts/application/services/accounts.service.ts`
  - `backend/src/modules/accounts/infrastructure/repositories/prisma-account.repository.ts`
  - `backend/src/modules/accounts/index.ts`

**Passos:**
- [x] Criar os DTOs tipados de entrada/saída (`CreateAccountInputDto`, `UpdateAccountInputDto`, `ListAccountsInputDto`, `AccountResponseDto`, `ListAccountsMetaDto` estendendo `PaginationMeta`).
- [x] Implementar `account.mapper.ts` convertendo a entidade `Account` e `transactionsCount` para `AccountResponseDto` com valores monetários em `number` e datas em ISO string.
- [x] Implementar `AccountsService` garantindo isolamento estrito por `userId` (`404` para conta ausente ou de terceiros), verificação de unicidade de nome entre contas `ACTIVE` (`409`), imutabilidade de `initialBalance` no update, transições `deactivate`/`reactivate` e bloqueio de `deleteAccount` quando `countLinkedTransactions > 0` (`409`).
- [x] Implementar `PrismaAccountRepository` convertendo `Decimal` do Prisma com segurança, calculando `summary` (`totalBalance` de contas `ACTIVE`, `activeCount`, `inactiveCount`), aplicando paginação e tratando erros de constraint única do banco para `AppError` (`409`).
- [x] Expor os contratos públicos do módulo em `backend/src/modules/accounts/index.ts`.

**Pronto quando:**
- `AccountsService` e `PrismaAccountRepository` compilam sem erros e testes unitários de serviço validam todas as regras de negócio (unicidade entre ativas, IDOR, status, delete).

**Commit sugerido:**
`feat(accounts): implement accounts service, dtos, mapper and prisma repository`

---

## Task 4: Apresentação (`schemas`, `controller`, `routes`) e wiring da API

**Arquivos:**
- Criar:
  - `backend/src/modules/accounts/presentation/schemas/accounts.schemas.ts`
  - `backend/src/modules/accounts/presentation/controllers/accounts.controller.ts`
  - `backend/src/modules/accounts/presentation/routes/accounts.routes.ts`
- Modificar:
  - `backend/src/app/app.ts`
  - `backend/src/app/compositon-root.ts`

**Passos:**
- [x] Criar schemas Zod em `accounts.schemas.ts` para `accountIdParamSchema`, `listAccountsQuerySchema`, `createAccountSchema` (`initialBalance >= 0`) e `updateAccountSchema` (`.strict()` rejeitando alteração de `initialBalance`, `currentBalance`, `status` ou `userId`).
- [x] Implementar `AccountsController` reutilizando `parsePagination`, `createPaginationMeta`, `sendSuccess`, `sendCreated`, `sendNoContent` e `AppError`.
- [x] Implementar `createAccountsRouter` aplicando `authenticate` em todas as rotas e `validateCsrf` em `POST`, `PATCH` e `DELETE` para:
  - `POST /`
  - `GET /`
  - `GET /:accountId`
  - `PATCH /:accountId`
  - `PATCH /:accountId/deactivate`
  - `PATCH /:accountId/reactivate`
  - `DELETE /:accountId`
- [x] Registrar `app.use("/api/v1/accounts", options.accountsRouter)` em `app.ts` e compor dependências em `compositon-root.ts`.

**Pronto quando:**
- Todas as rotas sob `/api/v1/accounts` respondem respeitando os contratos globais (`SuccessResponse`, `PaginationMeta`, `AppError`), autenticação e CSRF.

**Commit sugerido:**
`feat(accounts): expose versioned accounts http routes and controller`

---

## Task 5: Testes automatizados e verificação do backend

**Arquivos:**
- Criar:
  - `backend/test/accounts/account.entity.test.ts`
  - `backend/test/accounts/accounts.service.test.ts`
  - `backend/test/accounts/accounts.routes.test.ts`

**Passos:**
- [x] Cobrir invariantes da entidade `Account` (`initialBalance >= 0`, `color`, unicidade normalizada, ciclo de vida).
- [x] Cobrir `AccountsService` (criação, duplicidade apenas entre ativas, imutabilidade de `initialBalance`, bloqueio IDOR, desativação/reativação e exclusão física).
- [x] Cobrir rotas HTTP `/api/v1/accounts*` (autenticação obrigatória `401`, validação Zod `400`, conflitos `409`, `404` em conta de outro usuário, `200`/`201`/`204` conforme contrato).
- [ ] Executar `yarn tsc --noEmit` (ou script de build/test em `backend/package.json`) dentro de `backend/` *(executado em 2026-11-15: `prisma:validate` PASS; `114/114` testes em `test/accounts/*.test.ts`, `test/prisma/*.test.ts`, `test/http-contracts/*.test.ts` e 3 testes MFA PASS; `0` erros de TS em `src/`, `prisma/`, `generated/prisma/`, `test/accounts/`, `test/prisma/`, `test/http-contracts/` e 3 testes MFA; `yarn tsc --noEmit` global segue com `exit code 1` devido a `56` erros pré-existentes em `16` arquivos de teste legados em `test/auth/`, `test/logging/` e `test/users/`).*

**Pronto quando:**
- Todos os testes e checagens de tipagem/build em `backend/` passam sem falhas *(pendente apenas correção dos 16 arquivos de teste legados para `tsc --noEmit` global zerar, além da aplicação da migration `20261115161500_create_accounts_table` e `seed` em PostgreSQL real).*

**Commit sugerido:**
`test(accounts): add unit and http tests for accounts module`
