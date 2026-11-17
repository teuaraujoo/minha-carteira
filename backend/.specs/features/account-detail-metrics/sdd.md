# SDD — Métricas de detalhes da conta (`GET /api/v1/accounts/:accountId`)

> **Status do documento:** Spec técnica proposta para atualização do módulo `backend/src/modules/accounts/`.

## 1. Arquivos impactados

Nenhum arquivo novo de rota ou tabela é necessário; todas as mudanças permanecem encapsuladas no módulo `accounts` e seus testes:

```text
backend/src/modules/accounts/
├── domain/
│   └── interfaces/
│       ├── account.interfaces.ts            # Novos tipos de consulta e agregação de métricas
│       └── account-repository.interface.ts  # Novo método getDetailMetrics(...)
├── application/
│   ├── dto/
│   │   └── account.dto.ts                   # AccountDetailResponseDto + DTOs de métricas
│   ├── mappers/
│   │   └── account.mapper.ts                # toAccountDetailResponseDto(...)
│   └── services/
│       └── accounts.service.ts              # getAccountById(...) recebe competência opcional
├── infrastructure/
│   └── repositories/
│       └── prisma-account.repository.ts     # Consultas agregadas em `transactions` e `categories`
└── presentation/
    ├── schemas/
    │   └── accounts.schemas.ts              # getAccountDetailQuerySchema (?month=11/2026)
    └── controllers/
        └── accounts.controller.ts           # Valida query em getById(...)
```

---

## 2. Contratos de entrada e saída

### 2.1. Query da rota (`accounts.schemas.ts`)

- Rota: `GET /api/v1/accounts/:accountId`
- Query schema (`getAccountDetailQuerySchema`):
  - `month`: string opcional.
  - Formatos aceitos após `trim()`:
    - `MM/YYYY` (regex `/^(0[1-9]|1[0-2])\/(19\d{2}|20\d{2}|2100)$/`), ex.: `11/2026`;
    - `YYYY-MM` (regex `/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])$/`), ex.: `2026-11` (opcional para compatibilidade ISO).
  - Transformação: converte para `{ year: number; month: number }` (1 a 12).
  - `.strict()` para rejeitar query params inesperados com `400 VALIDATION_ERROR`.
  - Se `month` não for enviado, `AccountsService.getAccountById` usa o mês e ano atuais (`new Date()` em UTC civil).

### 2.2. DTOs (`account.dto.ts`)

```typescript
export interface GetAccountByIdInputDto {
  userId: string;
  accountId: string;
  month?: number | undefined;
  year?: number | undefined;
}

export interface AccountMonthlySeriesItemDto {
  month: string;
  label: string;
  income: number;
  expense: number;
}

export interface AccountCategorySpendItemDto {
  categoryId: string | null;
  name: string;
  color: string | null;
  icon: string | null;
  amount: number;
  percentage: number;
}

export interface AccountDetailMetricsDto {
  month: string;
  income: number;
  expense: number;
  netResult: number;
  projectedBalance: number;
  pending: {
    count: number;
    amount: number;
    incomeAmount: number;
    expenseAmount: number;
  };
  monthlySeries: AccountMonthlySeriesItemDto[];
  categorySpend: AccountCategorySpendItemDto[];
}

export interface AccountDetailResponseDto extends AccountResponseDto {
  metrics: AccountDetailMetricsDto;
}
```

---

## 3. Fluxo de execução (`GET /api/v1/accounts/:accountId`)

1. **Entrada e autenticação:** `createAuthenticationMiddleware` injeta `request.auth.userId`.
2. **Validação:** `AccountsController.getById` valida `request.params` com `accountIdParamSchema` e `request.query` com `getAccountDetailQuerySchema`.
3. **Serviço (`AccountsService.getAccountById`):**
   - Busca a conta via `requireOwnedAccount(accountId, userId)` (`404` se não existir ou pertencer a outro usuário);
   - Resolve `(targetYear, targetMonth)` (informados na query ou data corrente);
   - Executa em paralelo `countLinkedTransactions(account.id, userId)` e `getDetailMetrics({ accountId: account.id, userId, year: targetYear, month: targetMonth })`;
   - Calcula `projectedBalance = round2(account.currentBalance + metrics.pending.incomeAmount - metrics.pending.expenseAmount)`;
   - Mapeia via `toAccountDetailResponseDto(account, transactionsCount, metrics)` e responde com `sendSuccess(response, detail)`.

---

## 4. Estratégia de consulta no `PrismaAccountRepository`

Para a competência `(year, month)`:
- `monthStart`: `new Date(Date.UTC(year, month - 1, 1))`
- `nextMonthStart`: `new Date(Date.UTC(year, month, 1))`
- `seriesStart`: `new Date(Date.UTC(year, month - 6, 1))` (início exato da janela de 6 meses encerrando em `nextMonthStart` exclusivo)

Consultas filtradas por `{ userId, accountId, deletedAt: null }` dentro da janela `[seriesStart, nextMonthStart)`:
1. **Série dos 6 meses + resumo confirmado do mês:**
   - Buscar transações confirmadas (`status: "CONFIRMED"`, `transactionDate: { gte: seriesStart, lt: nextMonthStart }`) selecionando apenas `{ type, amount, transactionDate, categoryId }` (ou `groupBy` no Prisma), agregando por mês (`MM/YYYY`) e somando no mês alvo (`income`, `expense`, `netResult`) e nos 6 slots cronológicos de `monthlySeries`.
2. **Pendências do mês alvo:**
   - Agregar (`groupBy` por `type` com `_sum: { amount }` e `_count: { _all: true }`) para `status: "PENDING"` e `transactionDate: { gte: monthStart, lt: nextMonthStart }`, obtendo `pending.count`, `pending.incomeAmount`, `pending.expenseAmount` e `pending.amount`.
3. **Gastos por categoria no mês alvo:**
   - Agregar (`groupBy` por `categoryId` com `_sum: { amount }`) para `type: "EXPENSE"`, `status: "CONFIRMED"` e `transactionDate: { gte: monthStart, lt: nextMonthStart }`.
   - Resolver metadados (`name`, `color`, `icon`) das categorias encontradas via `prisma.category.findMany({ where: { id: { in: categoryIds } } })`.
   - Mapear `categoryId === null` como `"Sem categoria"`, calcular `percentage` sobre o total de despesas confirmadas do mês e ordenar por `amount` descendente.

---

## 5. Riscos e decisões técnicas

- **Datas civis em UTC:** a coluna `transactions.transaction_date` é `@db.Date`; construir limites com `Date.UTC(year, month - 1, 1)` evita desvios de fuso horário (`-03:00`) na virada de mês.
- **Arredondamento monetário:** todas as somas de `Decimal` devem ser convertidas com precisão de 2 casas decimais (`Math.round(value * 100) / 100`) para evitar ruído binário de ponto flutuante (`0.1 + 0.2`).
- **Labels dos meses (`monthlySeries`):** usar abreviações fixas em português brasileiro (`["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]`) formatadas como `"Nov/2026"`, evitando variação de `Intl.DateTimeFormat` entre ambientes Node/SO.
