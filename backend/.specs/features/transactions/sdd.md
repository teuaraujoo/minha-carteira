# SDD — Módulo de transações financeiras (`transactions`)

> **Status do documento:** Spec técnica aprovada e finalizada para implementação do módulo `transactions`.

## 1. Visão arquitetural e organização de arquivos

O módulo `backend/src/modules/transactions/` seguirá a arquitetura modular em camadas já adotada em `accounts`:

```text
backend/src/modules/transactions/
├── index.ts
├── domain/
│   ├── enums/
│   │   └── transaction.enums.ts
│   ├── entities/
│   │   └── transaction.entity.ts
│   └── interfaces/
│       ├── transaction.interfaces.ts
│       └── transaction-repository.interface.ts
├── application/
│   ├── dto/
│   │   └── transaction.dto.ts
│   ├── mappers/
│   │   └── transaction.mapper.ts
│   └── services/
│       └── transactions.service.ts
├── infrastructure/
│   └── repositories/
│       └── prisma-transaction.repository.ts
└── presentation/
    ├── schemas/
    │   └── transactions.schemas.ts
    ├── controllers/
    │   └── transactions.controller.ts
    └── routes/
        └── transactions.routes.ts
```

---

## 2. Persistência planejada (`backend/prisma/schema.prisma`)

### 2.1. Enums

```prisma
enum TransactionType {
  INCOME
  EXPENSE
}

enum TransactionStatus {
  CONFIRMED
  PENDING
}
```

### 2.2. Model `transactions` (decisões confirmadas)

```prisma
model transactions {
  id               String            @id @default(uuid()) @db.Uuid
  user_id          String            @db.Uuid
  account_id       String            @db.Uuid
  category_id      String?           @db.Uuid
  description      String            @db.VarChar(120)
  amount           Decimal           @db.Decimal(14, 2)
  type             TransactionType
  status           TransactionStatus @default(CONFIRMED)
  transaction_date DateTime          @db.Date
  notes            String?           @db.VarChar(500)
  confirmed_at     DateTime?
  created_at       DateTime          @default(now())
  updated_at       DateTime          @updatedAt
  deleted_at       DateTime?

  users      users       @relation(fields: [user_id], references: [id], onDelete: Cascade)
  accounts   accounts    @relation(fields: [account_id], references: [id], onDelete: Restrict)
  categories categories? @relation(fields: [category_id], references: [id], onDelete: Restrict)

  @@index([user_id, deleted_at, transaction_date])
  @@index([user_id, account_id, deleted_at])
  @@index([user_id, category_id, deleted_at])
  @@index([user_id, status, deleted_at])
  @@index([user_id, type, deleted_at])
}
```

> **Nota sobre recorrências:** `scheduled_date` e `recurring_rule_id` **não** entram nesta etapa; serão adicionados em migration futura quando o módulo `recurring-transactions` for especificado.

### 2.3. Referência para `categories`

A modelagem completa de `categories` está documentada em `backend/.specs/features/categories/sdd.md` (`id`, `user_id?`, `name`, `color?`, `icon?`, `is_default`, `status` `ACTIVE`/`INACTIVE`, `created_at`, `updated_at`, sem `type` e sem `deleted_at`).

### 2.4. Check constraints no PostgreSQL (SQL de migration)

- `amount > 0` (o sinal financeiro é sempre inferido por `type`);
- `char_length(trim(description)) >= 2`.

---

## 3. Regras de negócio e consistência de saldo

1. **Validação de propriedade e estado ativo (sem gateway extra):**
   - Na criação, verificar via `AccountsService` que `account_id` pertence ao `user_id` autenticado e está com `status = ACTIVE`.
   - Quando `category_id` for informado, validar diretamente via `CategoriesService` (busca por ID) que a categoria existe, está acessível ao usuário (`is_default = true` ou `user_id = req.user.id`) e está com `status = ACTIVE`.
2. **Atualização atômica de saldo (`$transaction` do Prisma):**
   - **Criação com `status = CONFIRMED`:** atualiza `accounts.current_balance` (`+amount` se `INCOME`, `-amount` se `EXPENSE`).
   - **Criação com `status = PENDING`:** não altera `accounts.current_balance`.
   - **Confirmação (`PENDING` → `CONFIRMED`):** válida para `INCOME` e `EXPENSE`, sempre validando que `status === "PENDING"` (retornando erro de conflito/estado inválido se já estiver `CONFIRMED`); preenche `confirmed_at = now` e aplica `+amount` (ou `-amount`) em `accounts.current_balance`.
   - **Exclusão lógica (`deleted_at = now`):** se a transação estava `CONFIRMED`, estorna o impacto em `accounts.current_balance` (`-amount` para `INCOME`, `+amount` para `EXPENSE`); se estava `PENDING`, apenas marca `deleted_at`.
3. **Imutabilidade financeira pós-criação:**
   - Lançamentos criados não são editáveis via `PATCH`; para alterar qualquer dado financeiro, a transação deve ser excluída logicamente (`DELETE`) e relançada (`POST`). Apenas o status pode avançar de `PENDING` para `CONFIRMED` em `PATCH /api/v1/transactions/:transactionId/confirm`.

---

## 4. Contratos HTTP planejados (`/api/v1/transactions`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `POST` | `/api/v1/transactions` | Cria receita ou despesa (`CONFIRMED` ou `PENDING`) na mesma rota |
| `GET` | `/api/v1/transactions` | Lista transações não excluídas com paginação, filtros na URL (`status`, `type`, `accountId`, `categoryId`, `dateFrom`, `dateTo`, `search`), ordenação (`sortBy=transactionDate\|amount`, `sortOrder=asc\|desc`) e resumo consolidado em `meta` |
| `GET` | `/api/v1/transactions/:transactionId` | Detalha uma transação do usuário |
| `PATCH` | `/api/v1/transactions/:transactionId/confirm` | Confirma uma transação `PENDING` (`INCOME` ou `EXPENSE`) validando o status atual |
| `DELETE` | `/api/v1/transactions/:transactionId` | Realiza exclusão lógica (`deletedAt`) e ajusta saldo se necessário |

Todos os endpoints utilizam:
- `createAuthenticationMiddleware` (isolamento por `req.user.id`);
- `createCsrfValidationMiddleware` nas rotas de mutação;
- `parsePagination` e `createPaginationMeta` na listagem (acrescido dos totais consolidados `totalIncome`, `totalExpense`, `netResult`, `pendingIncomeAmount`, `pendingIncomeCount` em `meta`);
- `sendSuccess`, `sendCreated`, `sendNoContent` e `AppError`/`ErrorCode` em português brasileiro.
