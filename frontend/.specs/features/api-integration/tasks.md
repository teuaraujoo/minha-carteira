# Integração do Frontend com o Backend (`api-integration`) — Plano de tarefas

## Objetivo
Conectar todas as telas ativas do frontend (`/login`, `/login/mfa`, `/register`, `/accounts`, `/accounts/[accountId]`, `/categories`, `/transactions` e `AppShell`) às rotas reais `/api/v1/*` do backend, substituindo os stores mockados em memória.

## Restrições globais
- Não alterar contratos ou rotas do backend nesta etapa.
- Seguir `AGENTS.md`: comentários, mensagens de erro e UI em português brasileiro; identificadores e nomes de arquivo em inglês (`kebab-case`); Yarn 4 dentro de `frontend/`.
- Preservar o layout, `.page-fade-in`, `AnimatedMetricNumber` e `react-hot-toast`.

---

## Task 1: Cliente HTTP base (`api-client.ts`) e serviços de domínio

**Arquivos:**
- Criar:
  - `frontend/services/api-client.ts`
  - `frontend/services/auth.service.ts`
  - `frontend/services/users.service.ts`
  - `frontend/services/accounts.service.ts`
  - `frontend/services/categories.service.ts`
  - `frontend/services/transactions.service.ts`
  - `frontend/lib/formatters.ts` (formatadores e persistência local da preferência `hideValues`)

**Passos:**
- [x] Implementar `apiClient` com `NEXT_PUBLIC_API_URL`, `credentials: "include"`, obtenção/envio automático de `x-csrf-token`, parser de `{ data, meta }` / `ApiClientError` e retry único após `POST /api/v1/auth/refresh` em respostas `401`.
- [x] Tipar e implementar os métodos de `auth.service.ts`, `users.service.ts`, `accounts.service.ts` (incluindo `AccountDetailResponseDto` com `?month=MM/YYYY`), `categories.service.ts` e `transactions.service.ts`.
- [x] Extrair helpers compartilhados (`formatCurrencyBRL`, `formatDisplayCurrency`, leitura/escrita da preferência `hideValues` em `localStorage`) para `frontend/lib/formatters.ts`.

---

## Task 2: Fluxo de autenticação e sessão (`AppShell`, `/login`, `/login/mfa`, `/register`)

**Arquivos:**
- Modificar:
  - `frontend/lib/auth-onboarding-storage.ts`
  - `frontend/components/ui/smoke-login.tsx`
  - `frontend/components/ui/smoke-mfa-verify.tsx`
  - `frontend/components/ui/smoke-register.tsx`
  - `frontend/components/app-shell.tsx`

**Passos:**
- [x] Persistir `challengeId` e `nextAttemptAt` junto ao e-mail pendente em `auth-onboarding-storage.ts`.
- [x] Conectar `SmokeLogin` a `authService.requestMfa`, `SmokeMfaVerify` a `authService.validateMfa` (e reenvio via `requestMfa`) e `SmokeRegister` a `authService.register`, exibindo mensagens reais da API em erros `400`/`409`/`429`.
- [x] Conectar `AppShell` a `usersService.getMe()` para exibir o usuário autenticado, tratar sessão inválida redirecionando para `/login` e integrar o botão de sair a `authService.logout()`.

---

## Task 3: Integração de Contas (`/accounts` e `/accounts/[accountId]`)

**Arquivos:**
- Modificar:
  - `frontend/app/accounts/page.tsx`
  - `frontend/app/accounts/[accountId]/page.tsx`
  - `frontend/components/accounts/account-preview-panel.tsx`
  - `frontend/components/accounts/account-detail-view.tsx`
  - `frontend/components/accounts/account-form-dialog.tsx`
  - `frontend/components/accounts/account-catalog.ts`

**Passos:**
- [x] Substituir `useAccountsStore` em `/accounts` por chamadas a `accountsService.list`, `create`, `update`, `deactivate`, `reactivate` e `remove`.
- [x] No `AccountPreviewPanel`, buscar `accountsService.getById(selectedId)` e as 5 últimas movimentações via `transactionsService.list({ accountId: selectedId, pageSize: 5 })`.
- [x] Em `/accounts/[accountId]` (`AccountDetailView`), consumir `accountsService.getById(accountId, selectedMonth)` (`MM/YYYY`) para alimentar os 6 KPIs e os gráficos (`monthlySeries` e `categorySpend`), além de `transactionsService.list` para a listagem filtrada de movimentações da conta.

---

## Task 4: Integração de Categorias (`/categories`) e Transações (`/transactions`)

**Arquivos:**
- Modificar:
  - `frontend/app/categories/page.tsx`
  - `frontend/components/categories/category-form-dialog.tsx`
  - `frontend/components/categories/categories-table.tsx`
  - `frontend/app/transactions/page.tsx`
  - `frontend/components/transactions/transaction-form-dialog.tsx`
  - `frontend/components/transactions/transactions-table.tsx`
  - `frontend/components/transactions/transaction-detail-dialog.tsx`

**Passos:**
- [x] Conectar `/categories` a `categoriesService` (listagem, filtros, criação, edição, ativação/desativação e exclusão) mantendo categorias `isDefault` somente leitura.
- [x] Conectar `/transactions` a `transactionsService.list` com paginação real (`page`, `pageSize`), ordenação e filtros enviados para a API, usando `meta` para os KPIs.
- [x] Conectar `TransactionFormDialog`, `TransactionDetailDialog` e ações da tabela (`confirm`, `delete`) às rotas reais de `transactions` e listas reais de contas/categorias ativas.

---

## Task 5: Limpeza dos mocks e validação final

**Arquivos:**
- Remover (após migração):
  - `frontend/components/accounts/accounts-mock-store.tsx`
  - `frontend/components/categories/categories-mock-store.tsx`
- Limpar dados estáticos em `frontend/components/transactions/transaction-catalog.ts`

**Passos:**
- [x] Remover stores mockados não mais referenciados e limpar imports órfãos.
- [x] Executar `yarn lint` e `yarn build` em `frontend/` e validar com subagentes.
- [ ] Testar manualmente o fluxo completo com `backend` e `frontend` em execução (`CORS_ALLOWED_ORIGINS` e `NEXT_PUBLIC_API_URL` configurados).
