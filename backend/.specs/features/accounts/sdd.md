# SDD — Módulo de contas financeiras (`accounts`)

> **Status do documento:** Spec técnica completa da estrutura base do módulo `accounts` (CRUD e ciclo de vida), pronta para implementação independente de `transactions`.

## 1. Visão arquitetural e organização de arquivos

O módulo `backend/src/modules/accounts/` segue a arquitetura modular em camadas já adotada em `users` e `auth`:

```text
backend/src/modules/accounts/
├── index.ts
├── domain/
│   ├── enums/
│   │   └── account.enums.ts
│   ├── entities/
│   │   └── account.entity.ts
│   └── interfaces/
│       ├── account.interfaces.ts
│       └── account-repository.interface.ts
├── application/
│   ├── dto/
│   │   └── account.dto.ts
│   ├── mappers/
│   │   └── account.mapper.ts
│   └── services/
│       └── accounts.service.ts
├── infrastructure/
│   └── repositories/
│       └── prisma-account.repository.ts
└── presentation/
    ├── schemas/
    │   └── accounts.schemas.ts
    ├── controllers/
    │   └── accounts.controller.ts
    └── routes/
        └── accounts.routes.ts
```

Além do módulo, integram a entrega:
- `backend/prisma/schema.prisma` + `backend/prisma/migrations/<timestamp>_create_accounts_table/{migration.sql,down.sql}`;
- `backend/prisma/scripts/{data/demo-data.ts,database-maintenance.ts,seed/seed.ts,reset/reset.ts}`;
- `backend/src/app/app.ts` e `backend/src/app/compositon-root.ts` (montagem sob `/api/v1/accounts`).

---

## 2. Persistência (`backend/prisma/schema.prisma` e PostgreSQL)

### 2.1. Schema Prisma

```prisma
enum AccountType {
  CHECKING
  CASH
  DIGITAL
  SAVINGS
  INVESTMENT
}

enum AccountStatus {
  ACTIVE
  INACTIVE
}

model Account {
  id             String        @id @default(uuid()) @db.Uuid
  userId         String        @map("user_id") @db.Uuid
  name           String        @db.VarChar(80)
  type           AccountType
  brand          String?       @db.VarChar(60)
  institution    String?       @db.VarChar(80)
  color          String?       @db.VarChar(7)
  initialBalance Decimal       @map("initial_balance") @db.Decimal(14, 2)
  currentBalance Decimal       @map("current_balance") @db.Decimal(14, 2)
  status         AccountStatus @default(ACTIVE)
  inactivatedAt  DateTime?     @map("inactivated_at")
  createdAt      DateTime      @default(now()) @map("created_at")
  updatedAt      DateTime      @updatedAt @map("updated_at")
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userId, type, status])
  @@index([userId, inactivatedAt])
  @@map("accounts")
}
```

E no model `User`:
```prisma
  accounts              Account[]
```

### 2.2. Regras de integridade no PostgreSQL (Migration)

1. **Unicidade apenas entre contas `ACTIVE` do mesmo usuário:**
   - Como contas `INACTIVE` podem compartilhar nomes antigos com novas contas `ACTIVE`, a unicidade não pode usar um `UNIQUE (user_id, name)` irrestrito. A migration deve criar um **índice único parcial**:
     ```sql
     CREATE UNIQUE INDEX "accounts_user_id_active_name_key"
       ON "accounts" ("user_id", lower(btrim("name")))
       WHERE "status" = 'ACTIVE';
     ```
2. **Check constraints de domínio no banco:**
   - `initial_balance >= 0` (`CHECK ("initial_balance" >= 0)`);
   - Coerência de status: `(status = 'ACTIVE' AND inactivated_at IS NULL) OR (status = 'INACTIVE' AND inactivated_at IS NOT NULL)`;
   - Cor hexadecimal opcional: `color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'`.
3. **Migration conforme `backend/.specs/README.md`:**
   - Envolvida em `BEGIN; ... COMMIT;`;
   - Registro idempotente em `"_prisma_migrations"` quando a tabela existir;
   - Arquivo `down.sql` correspondente na mesma pasta (removendo índices, tabela `accounts` e enums `AccountType`/`AccountStatus`) referenciado ao final de `migration.sql`.

---

## 3. Camada de Domínio (`domain/`)

### 3.1. `account.enums.ts`

```typescript
export enum AccountType {
  CHECKING = "CHECKING",
  CASH = "CASH",
  DIGITAL = "DIGITAL",
  SAVINGS = "SAVINGS",
  INVESTMENT = "INVESTMENT",
}

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}
```

### 3.2. `account.entity.ts`

Entidade `Account` pura (sem importar Prisma ou Express), encapsulando invariantes:
- `name`: obrigatório após `trim()`, tamanho entre `2` e `80` caracteres.
- `initialBalance`: `number` finito, `>= 0`, arredondado/validado para 2 casas decimais.
- Na criação (`Account.create(...)`), `currentBalance` inicia igual a `initialBalance`, `status = AccountStatus.ACTIVE` e `inactivatedAt = null`.
- `brand` e `institution`: normalizados via `trim()`, convertidos para `null` quando vazios.
- `color`: quando informado, validado contra `/^#[0-9A-Fa-f]{6}$/` e normalizado em maiúsculas (ex.: `#012048`), ou `null`.
- Métodos de comportamento:
  - `updateDetails(...)`: atualiza apenas `name`, `type`, `brand`, `institution`, `color` e `updatedAt` (nunca altera `initialBalance` nem `currentBalance`);
  - `deactivate(now)`: se já estiver `INACTIVE`, lança erro de domínio ou mantém operação idempotente conforme regra do service; define `status = INACTIVE` e `inactivatedAt = now`;
  - `reactivate(now)`: define `status = ACTIVE` e `inactivatedAt = null`.

### 3.3. `account.interfaces.ts` e `account-repository.interface.ts`

- Interfaces de filtro e resumo no repositório:
  - `AccountFilter`: `{ userId: string; status?: AccountStatus; type?: AccountType; search?: string }`;
  - `AccountPaginationQuery`: `AccountFilter & PaginationInput` (reutilizando `PaginationInput` de `shared/application/contracts/pagination.contract.ts`);
  - `AccountListSummary`: `{ totalBalance: number; activeCount: number; inactiveCount: number }` (calculado sempre sobre as contas do `userId`, sendo `totalBalance` a soma de `currentBalance` de todas as contas `ACTIVE` do usuário);
  - `PaginatedAccountsResult`: `{ items: Account[]; total: number; summary: AccountListSummary }`.
- `IAccountRepository`:
  - `create(account: Account): Promise<Account>`
  - `findByIdAndUserId(id: string, userId: string): Promise<Account | null>`
  - `findActiveByNormalizedName(userId: string, normalizedName: string, excludeAccountId?: string): Promise<Account | null>`
  - `findManyByUserId(query: AccountPaginationQuery): Promise<PaginatedAccountsResult>`
  - `update(account: Account): Promise<Account>`
  - `deleteByIdAndUserId(id: string, userId: string): Promise<boolean>`
  - `countLinkedTransactions(accountId: string, userId: string): Promise<number>` *(gancho preparatório confirmado: retorna `0` nesta etapa até a implementação de `transactions`, quando passará a consultar os lançamentos reais vinculados à conta)*

---

## 4. Camada de Aplicação (`application/`)

### 4.1. DTOs (`application/dto/account.dto.ts`)

- **Entrada:**
  - `CreateAccountInputDto`: `{ userId: string; name: string; type: AccountType; initialBalance: number; brand?: string | null; institution?: string | null; color?: string | null }`
  - `ListAccountsInputDto`: `{ userId: string; page: number; pageSize: number; offset: number; status?: AccountStatus; type?: AccountType; search?: string }`
  - `GetAccountByIdInputDto`: `{ userId: string; accountId: string }`
  - `UpdateAccountInputDto`: `{ userId: string; accountId: string; name?: string; type?: AccountType; brand?: string | null; institution?: string | null; color?: string | null }`
  - `ChangeAccountStatusInputDto`: `{ userId: string; accountId: string }`
  - `DeleteAccountInputDto`: `{ userId: string; accountId: string }`
- **Saída:**
  - `AccountResponseDto`:
    ```typescript
    export interface AccountResponseDto {
      id: string;
      name: string;
      type: AccountType;
      brand: string | null;
      institution: string | null;
      color: string | null;
      initialBalance: number;
      currentBalance: number;
      status: AccountStatus;
      inactivatedAt: string | null;
      createdAt: string;
      updatedAt: string;
      /** Campo calculado (não persistido em coluna de `accounts`); retorna 0 até a integração com `transactions`. */
      transactionsCount: number;
    }
    ```
  - `ListAccountsMetaDto` (estende `PaginationMeta` global sem modificá-lo):
    ```typescript
    export interface ListAccountsMetaDto extends PaginationMeta {
      totalBalance: number;
      activeCount: number;
      inactiveCount: number;
    }
    ```

### 4.2. Casos de uso em `AccountsService`

1. **`createAccount(input)`**:
   - Verifica `findActiveByNormalizedName(userId, normalizedName)` → se existir, lança `AppError` `409 Conflict` (`"Já existe uma conta ativa cadastrada com esse nome."`).
   - Instancia `Account.create(...)`, persiste via `repository.create(...)` e retorna `AccountResponseDto`.
2. **`listAccounts(input)`**:
   - Consulta `repository.findManyByUserId(input)` com filtros (`status`, `type`, `search`) e paginação já validada via `parsePagination`.
   - Monta `meta` compondo `{ ...createPaginationMeta(pagination, result.total), ...result.summary }`.
3. **`getAccountById(input)`**:
   - Busca por `findByIdAndUserId(accountId, userId)`. Se nulo, lança `AppError` `404 Not Found` (`"Conta não encontrada."`).
   - Consulta `countLinkedTransactions(accountId, userId)` e mapeia para `AccountResponseDto`.
4. **`updateAccount(input)`**:
   - Busca por `findByIdAndUserId(accountId, userId)` (`404` se inexistente ou de outro usuário).
   - Se `name` foi informado e a conta estiver `ACTIVE`, verifica unicidade entre contas `ACTIVE` excluindo `accountId` (`409 Conflict` se duplicado).
   - Chama `account.updateDetails(...)`, persiste via `repository.update(...)` e retorna `AccountResponseDto`.
5. **`deactivateAccount(input)`**:
   - Busca por `findByIdAndUserId` (`404` se inexistente).
   - Se já estiver `INACTIVE`, retorna `409 Conflict` (`"Esta conta já está inativa."`).
   - Chama `account.deactivate(new Date())` e persiste.
6. **`reactivateAccount(input)`**:
   - Busca por `findByIdAndUserId` (`404` se inexistente).
   - Se já estiver `ACTIVE`, retorna `409 Conflict` (`"Esta conta já está ativa."`).
   - Verifica `findActiveByNormalizedName(userId, normalizedName, accountId)` → se já existir outra conta ativa com o mesmo nome, lança `409 Conflict` (`"Já existe outra conta ativa com esse nome. Renomeie antes de reativar."`).
   - Chama `account.reactivate(new Date())` e persiste.
7. **`deleteAccount(input)`**:
   - Busca por `findByIdAndUserId` (`404` se inexistente).
   - Verifica `countLinkedTransactions(accountId, userId)`. Se `> 0`, lança `AppError` `409 Conflict` (`"Contas com movimentações vinculadas não podem ser excluídas. Desative a conta para preservar o histórico."`).
   - Executa exclusão física real `repository.deleteByIdAndUserId(accountId, userId)` (`204 No Content`).

---

## 5. Contratos HTTP (`presentation/` e `/api/v1/accounts`)

Todas as rotas exigem `authenticate` (`AUTH_COOKIE_NAMES.access`), e todas as mutações (`POST`, `PATCH`, `DELETE`) exigem `validateCsrf`.

| Método e Caminho | Ação | Validação Zod | Resposta de Sucesso |
| --- | --- | --- | --- |
| `POST /api/v1/accounts` | Criar conta | `name`, `type`, `initialBalance >= 0`, `brand?`, `institution?`, `color?` | `201 Created` via `sendCreated(res, accountDto)` |
| `GET /api/v1/accounts` | Listar contas do usuário | `page`, `pageSize` (`parsePagination`), `status?`, `type?`, `search?` | `200 OK` via `sendSuccess(res, items, meta)` |
| `GET /api/v1/accounts/:accountId` | Buscar conta por ID | `params.accountId` UUID | `200 OK` via `sendSuccess(res, accountDto)` |
| `PATCH /api/v1/accounts/:accountId` | Atualizar conta | `params.accountId` UUID + body estrito (`.strict()` rejeitando `initialBalance`, `currentBalance`, `status`, `userId`) | `200 OK` via `sendSuccess(res, accountDto)` |
| `PATCH /api/v1/accounts/:accountId/deactivate` | Desativar conta | `params.accountId` UUID | `200 OK` via `sendSuccess(res, accountDto)` |
| `PATCH /api/v1/accounts/:accountId/reactivate` | Reativar conta | `params.accountId` UUID | `200 OK` via `sendSuccess(res, accountDto)` |
| `DELETE /api/v1/accounts/:accountId` | Excluir conta (real) | `params.accountId` UUID | `204 No Content` via `sendNoContent(res)` |

### Detalhes de validação e segurança HTTP

- **Rejeição explícita de campos protegidos no `PATCH`:** usar `.strict()` no schema Zod de atualização para impedir que um cliente envie `initialBalance`, `currentBalance`, `status` ou `userId` no payload de atualização cadastral (`400 VALIDATION_ERROR`).
- **Valores monetários:** validar `initialBalance` como `number` finito, `>= 0` e com no máximo 2 casas decimais (`Math.round(val * 100)` consistente).
- **Logging e mensagens:** todas as mensagens de erro (`AppError`) e logs (`AppLogger`) devem ser escritas em português brasileiro, sem expor tokens ou dados internos do Prisma.
