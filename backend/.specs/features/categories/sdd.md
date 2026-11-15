# SDD — Módulo de categorias financeiras (`categories`)

> **Status do documento:** Spec técnica aprovada e finalizada para implementação do módulo `categories`.

## 1. Visão arquitetural e organização de arquivos

O módulo `backend/src/modules/categories/` seguirá a arquitetura modular em camadas adotada em `accounts`:

```text
backend/src/modules/categories/
├── index.ts
├── domain/
│   ├── enums/
│   │   └── category.enums.ts
│   ├── entities/
│   │   └── category.entity.ts
│   └── interfaces/
│       ├── category.interfaces.ts
│       └── category-repository.interface.ts
├── application/
│   ├── dto/
│   │   └── category.dto.ts
│   ├── mappers/
│   │   └── category.mapper.ts
│   └── services/
│       └── categories.service.ts
├── infrastructure/
│   └── repositories/
│       └── prisma-category.repository.ts
└── presentation/
    ├── schemas/
    │   └── categories.schemas.ts
    ├── controllers/
    │   └── categories.controller.ts
    └── routes/
        └── categories.routes.ts
```

---

## 2. Persistência planejada (`backend/prisma/schema.prisma`)

### 2.1. Enum

```prisma
enum CategoryStatus {
  ACTIVE
  INACTIVE
}
```

### 2.2. Model `categories`

```prisma
model categories {
  id         String         @id @default(uuid()) @db.Uuid
  user_id    String?        @db.Uuid
  name       String         @db.VarChar(60)
  color      String?        @db.VarChar(7)
  icon       String?        @db.VarChar(40)
  is_default Boolean        @default(false)
  status     CategoryStatus @default(ACTIVE)
  created_at DateTime       @default(now())
  updated_at DateTime       @updatedAt

  users        users?         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  transactions transactions[]

  @@index([user_id, status])
  @@index([is_default, status])
}
```

### 2.3. Check constraints e índices únicos (SQL de migration)

- `char_length(trim(name)) >= 2`;
- `color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$'`;
- Consistência padrão/personalizada: `(is_default = true AND user_id IS NULL) OR (is_default = false AND user_id IS NOT NULL)`;
- Índice único funcional para nomes padrão: `UNIQUE (lower(trim(name))) WHERE is_default = true`;
- Índice único funcional por usuário: `UNIQUE (user_id, lower(trim(name))) WHERE user_id IS NOT NULL`.

---

## 3. Seed das categorias padrão (`isDefault = true`)

Alinhado ao catálogo já utilizado no frontend (`transaction-catalog.ts` e `account-catalog.ts`), o seed inicial incluirá categorias globais com `user_id = null`, `is_default = true` e `status = ACTIVE`:

- Salário (`#00C7C4`, `briefcase`)
- Serviços (`#00C7C4`, `wrench`)
- Rendimentos (`#015363`, `trending-up`)
- Poupança (`#00C7C4`, `piggy-bank`)
- Investimentos (`#012048`, `trending-up`)
- Reembolsos (`#015363`, `rotate-ccw`)
- Alimentação (`#015363`, `utensils`)
- Moradia (`#012048`, `home`)
- Transporte (`#B45309`, `car`)
- Saúde (`#0F766E`, `heart-pulse`)
- Lazer (`#C2410C`, `gamepad-2`)
- Assinaturas (`#5B21B6`, `repeat`)
- Educação (`#0F766E`, `graduation-cap`)
- Tarifas (`#64748B`, `receipt`)
- Transferências (`#881337`, `arrow-left-right`)
- Outros (`#64748B`, `layers`)

*(Observação: como não há `type` em `categories`, "Outros" aparece uma única vez no seed).*

---

## 4. Contratos HTTP planejados (`/api/v1/categories`)

| Método | Rota | Descrição |
| --- | --- | --- |
| `GET` | `/api/v1/categories` | Lista categorias padrão (`isDefault = true`) e personalizadas do usuário autenticado com paginação global e filtros (`status`, `search`) |
| `POST` | `/api/v1/categories` | Cria categoria personalizada (`isDefault = false`) |
| `GET` | `/api/v1/categories/:categoryId` | Consulta uma categoria acessível ao usuário |
| `PATCH` | `/api/v1/categories/:categoryId` | Atualiza `name`, `color` ou `icon` de categoria personalizada do usuário |
| `PATCH` | `/api/v1/categories/:categoryId/deactivate` | Desativa categoria personalizada (`status = INACTIVE`) |
| `PATCH` | `/api/v1/categories/:categoryId/reactivate` | Reativa categoria personalizada (`status = ACTIVE`) |
| `DELETE` | `/api/v1/categories/:categoryId` | Exclui fisicamente categoria personalizada sem transações vinculadas (`409 Conflict` e orientação para inativar se houver vínculos; `onDelete: Restrict` no banco) |
