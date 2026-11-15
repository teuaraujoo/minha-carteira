# Módulo de categorias financeiras (`categories`) — Plano de tarefas

## Objetivo
Implementar o módulo completo de `categories` no backend (persistência Prisma, seed de categorias padrão, domínio, aplicação, apresentação sob `/api/v1/categories` e testes), seguindo o padrão modular de `accounts` e os contratos globais do projeto.

## Restrições globais
- Reutilizar obrigatoriamente os contratos globais em `backend/src/shared/`: `parsePagination` e `createPaginationMeta` (`pagination.ts`), `sendSuccess`, `sendCreated` e `sendNoContent` (`success-response.ts`), `AppError` e `ErrorCode` (`app-error.ts`) e os middlewares de autenticação e CSRF (`auth`).
- Categorias **não possuem `type`** e **não possuem `deletedAt`**: o ciclo de vida usa apenas `status` (`ACTIVE` | `INACTIVE`).
- Categorias padrão do sistema (`isDefault = true`, `userId = null`) são somente leitura para usuários finais; exclusão física (`DELETE`) só é permitida para categorias personalizadas sem transações vinculadas (`409 Conflict` e `onDelete: Restrict` caso haja vínculos).
- Seguir `backend/.specs/README.md` para migrations (`BEGIN; ... COMMIT;`, `_prisma_migrations` idempotente, `down.sql`) e `AGENTS.md` (mensagens de erro, comentários e logs em português brasileiro; Yarn 4 dentro de `backend/`).
- Sempre ler `feature.md` e `sdd.md` antes de executar as tasks e marcar `[x]` conforme concluir cada passo.
- Não fazer commits antes de revisão

---

## Task 1: Schema Prisma, migration (UP/DOWN) e seed padrão

**Arquivos:**
- Modificar:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/scripts/data/demo-data.ts`
  - `backend/prisma/scripts/database-maintenance.ts`
  - `backend/prisma/scripts/seed/seed.ts`
- Criar:
  - `backend/prisma/migrations/<timestamp>_create_categories_table/migration.sql`
  - `backend/prisma/migrations/<timestamp>_create_categories_table/down.sql`

**Passos:**
- [x] Adicionar `CategoryStatus` (`ACTIVE`, `INACTIVE`), o model `Category` mapeado para `categories` (`id`, `user_id?`, `name`, `color?`, `icon?`, `is_default`, `status`, `created_at`, `updated_at`) e a relação opcional em `User` (`onDelete: Cascade`) em `backend/prisma/schema.prisma`.
- [x] Adicionar índices `[userId, status]` (`[user_id, status]`) e `[isDefault, status]` (`[is_default, status]`).
- [x] Criar `migration.sql` dentro de `BEGIN; ... COMMIT;` com DDL, `CHECK` constraints (`char_length(btrim(name)) >= 2`, `color` `#RRGGBB`, coerência `is_default` vs `user_id`), índices únicos parciais por nome normalizado (padrão e por usuário) e registro idempotente em `"_prisma_migrations"`.
- [x] Criar `down.sql` removendo índices, tabela `categories`, enum `CategoryStatus` e registro em `"_prisma_migrations"`.
- [x] Atualizar `demo-data.ts`, `database-maintenance.ts` e `seed.ts` para popular as 16 categorias padrão (`isDefault = true`) de forma idempotente e incluir `categories` na limpeza segura.
- [x] Executar `yarn prisma:validate` e `yarn prisma:generate` em `backend/` *(validação em banco PostgreSQL real pendente de execução de migration em ambiente dedicado)*.

**Commit sugerido:**
`feat(categories): add categories table schema, migration and default seed`

---

## Task 2: Domínio de `categories` (enums, entidade e interfaces)

**Arquivos:**
- Criar:
  - `backend/src/modules/categories/domain/enums/category.enums.ts`
  - `backend/src/modules/categories/domain/entities/category.entity.ts`
  - `backend/src/modules/categories/domain/interfaces/category.interfaces.ts`
  - `backend/src/modules/categories/domain/interfaces/category-repository.interface.ts`

**Passos:**
- [x] Criar `CategoryStatus` (`ACTIVE`, `INACTIVE`) em `category.enums.ts`.
- [x] Implementar a entidade `Category` validando `name` (2–60 chars após `trim`), formato `#RRGGBB` em `color?`, normalização de `icon?`, proteção de categorias `isDefault = true` e transições `updateDetails`, `deactivate` e `reactivate`.
- [x] Definir `CategoryFilter`, `CategoryPaginationQuery` e `PaginatedCategoriesResult` em `category.interfaces.ts`.
- [x] Definir `ICategoryRepository` isolada em `category-repository.interface.ts` (sem Prisma ou Express), incluindo `countLinkedTransactions`.

**Commit sugerido:**
`feat(categories): add category domain entity, enums and repository interface`

---

## Task 3: Aplicação (`dto`, `mapper`, `service`) e repositório Prisma

**Arquivos:**
- Criar:
  - `backend/src/modules/categories/application/dto/category.dto.ts`
  - `backend/src/modules/categories/application/mappers/category.mapper.ts`
  - `backend/src/modules/categories/application/services/categories.service.ts`
  - `backend/src/modules/categories/infrastructure/repositories/prisma-category.repository.ts`
  - `backend/src/modules/categories/index.ts`

**Passos:**
- [x] Criar DTOs de entrada/saída (`CreateCategoryDto`, `UpdateCategoryDto`, `ListCategoriesQueryDto`, `CategoryResponseDto`).
- [x] Implementar `CategoryMapper` convertendo entidade para DTO e registro Prisma para entidade.
- [x] Implementar `CategoriesService` com listagem paginada (padrão + do usuário), criação personalizada, busca por ID (usada também por `TransactionsService`), atualização, desativação/reativação e exclusão física bloqueada (`409 Conflict`) quando houver vínculos ou `isDefault = true`.
- [x] Implementar `PrismaCategoryRepository` com filtros (`status`, `search`), paginação e verificação de unicidade de nome.

**Commit sugerido:**
`feat(categories): add categories service, dto, mapper and prisma repository`

---

## Task 4: Apresentação (`schemas`, `controller`, `routes`) e composição

**Arquivos:**
- Criar:
  - `backend/src/modules/categories/presentation/schemas/categories.schemas.ts`
  - `backend/src/modules/categories/presentation/controllers/categories.controller.ts`
  - `backend/src/modules/categories/presentation/routes/categories.routes.ts`
- Modificar:
  - `backend/src/app/app.ts`
  - `backend/src/app/compositon-root.ts`

**Passos:**
- [x] Criar schemas Zod para criação, atualização, query de listagem (`page`, `pageSize`, `status`, `search`) e parâmetro `:categoryId`.
- [x] Implementar `CategoriesController` utilizando `parsePagination`, `createPaginationMeta`, `sendSuccess`, `sendCreated`, `sendNoContent` e `AppError`.
- [x] Configurar `categories.routes.ts` com `createAuthenticationMiddleware` e `createCsrfValidationMiddleware` nas mutações.
- [x] Registrar `categoriesRouter` sob `/api/v1/categories` no composition root e em `app.ts`.

**Commit sugerido:**
`feat(categories): expose versioned categories http routes and controller`

---

## Task 5: Testes unitários e HTTP do módulo `categories`

**Arquivos:**
- Criar:
  - `backend/test/categories/category.entity.test.ts`
  - `backend/test/categories/categories.service.test.ts`
  - `backend/test/categories/categories.routes.test.ts`

**Passos:**
- [x] Cobrir invariantes da entidade `Category` e proteção contra alteração de categorias padrão.
- [x] Cobrir casos de uso do `CategoriesService` (unicidade de nome, anti-IDOR, bloqueio de exclusão com vínculo, paginação e filtros).
- [x] Cobrir rotas HTTP (`/api/v1/categories`), autenticação, CSRF e códigos de erro em português brasileiro.
- [x] Executar testes de `categories` (`yarn exec tsx --test test/categories/*.test.ts`) e checagem de tipos (`yarn exec tsc --noEmit`) em `backend/`.

**Commit sugerido:**
`test(categories): add unit and http tests for categories module`
