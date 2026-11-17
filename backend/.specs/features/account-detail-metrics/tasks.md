# Métricas de detalhes da conta (`account-detail-metrics`) — Plano de tarefas

## Objetivo
Atualizar `GET /api/v1/accounts/:accountId` no backend para aceitar `?month=MM/YYYY` (opcional, com fallback no mês/ano corrente) e retornar o objeto `metrics` completo para a página de detalhes da conta, mantendo intactos os contratos das demais rotas de `accounts`.

## Restrições globais
- Reutilizar `AppError`, `ErrorCode` e `sendSuccess` de `backend/src/shared/presentation/http/`.
- Não criar migrations nem alterar `schema.prisma`; usar os models `Account`, `Transaction` e `Category` existentes.
- Ignorar sempre transações com `deletedAt !== null` e manter isolamento estrito por `userId`.
- Seguir `AGENTS.md`: mensagens de erro, comentários e logs em português brasileiro; Yarn 4 dentro de `backend/`; usar subagentes para revisão e testes.
- Não commitar antes de revisão
- Aplicar alterações apenas no backend, não modificar o frontend

---

## Task 1: Contratos de domínio e DTOs de detalhes da conta

**Arquivos:**
- Modificar:
  - `backend/src/modules/accounts/domain/interfaces/account.interfaces.ts`
  - `backend/src/modules/accounts/domain/interfaces/account-repository.interface.ts`
  - `backend/src/modules/accounts/application/dto/account.dto.ts`
  - `backend/src/modules/accounts/application/mappers/account.mapper.ts`

**Passos:**
- [x] Definir os tipos de consulta e agregação (`AccountDetailMetricsQuery`, `AccountDetailMetricsData`, `AccountMonthlySeriesItem`, `AccountCategorySpendItem`) em `account.interfaces.ts`.
- [x] Adicionar `getDetailMetrics(query: AccountDetailMetricsQuery): Promise<AccountDetailMetricsData>` em `IAccountRepository` (`account-repository.interface.ts`).
- [x] Adicionar `month?` e `year?` em `GetAccountByIdInputDto` e criar `AccountDetailMetricsDto`, `AccountMonthlySeriesItemDto`, `AccountCategorySpendItemDto` e `AccountDetailResponseDto` em `account.dto.ts`.
- [x] Implementar `toAccountDetailResponseDto(account, transactionsCount, metrics)` em `account.mapper.ts` preservando `toAccountResponseDto`.

---

## Task 2: Agregações no `PrismaAccountRepository` e serviço `AccountsService`

**Arquivos:**
- Modificar:
  - `backend/src/modules/accounts/infrastructure/repositories/prisma-account.repository.ts`
  - `backend/src/modules/accounts/application/services/accounts.service.ts`

**Passos:**
- [x] Implementar helper de competência civil (`Date.UTC`) para calcular `monthStart`, `nextMonthStart` e `seriesStart` (janela de 6 meses) e labels em português (`"Jan/2026"`..`"Dez/2026"`).
- [x] Implementar `getDetailMetrics` em `PrismaAccountRepository` calculando:
  - `income`, `expense` e `netResult` confirmados no mês consultado;
  - `pending` (`count`, `amount`, `incomeAmount`, `expenseAmount`) para lançamentos `PENDING` no mês consultado;
  - `monthlySeries` com exatamente 6 posições preenchidas com `0` quando não houver lançamentos;
  - `categorySpend` agrupado por categoria (incluindo `"Sem categoria"` para `categoryId: null`), ordenado por valor descendente e com `percentage`.
- [x] Atualizar `AccountsService.getAccountById` para resolver a competência padrão quando `month`/`year` não forem informados, consultar `getDetailMetrics` e `countLinkedTransactions` em paralelo, calcular `projectedBalance` e retornar `AccountDetailResponseDto`.

---

## Task 3: Validação HTTP na rota `GET /api/v1/accounts/:accountId`

**Arquivos:**
- Modificar:
  - `backend/src/modules/accounts/presentation/schemas/accounts.schemas.ts`
  - `backend/src/modules/accounts/presentation/controllers/accounts.controller.ts`

**Passos:**
- [x] Criar `getAccountDetailQuerySchema` em `accounts.schemas.ts` aceitando `month` opcional (`MM/YYYY`, ex.: `11/2026`, e opcionalmente `YYYY-MM`) e rejeitando valores ou parâmetros inválidos em português brasileiro.
- [x] Atualizar `AccountsController.getById` para validar `request.query` com `getAccountDetailQuerySchema`, repassar `month`/`year` para `accountsService.getAccountById` e manter `sendSuccess(response, account)`.

---

## Task 4: Testes unitários e de integração HTTP

**Arquivos:**
- Modificar:
  - `backend/test/accounts/accounts.service.test.ts` (e/ou arquivo de testes HTTP de contas, caso aplicável)

**Passos:**
- [x] Testar parsing/validação de `?month=11/2026`, `?month=2026-11`, omissão de `month` (fallback mês atual) e erros `400` para competências inválidas (`13/2026`, `abc`).
- [x] Testar cálculo de `income`, `expense`, `netResult`, `projectedBalance`, `pending`, preenchimento dos 6 meses de `monthlySeries` e agrupamento de `categorySpend` (incluindo `"Sem categoria"` e exclusão lógica `deletedAt != null`).
- [x] Executar `yarn test` e `yarn typecheck` (conforme scripts em `backend/package.json`) no diretório `backend/` e revisar com subagentes.
