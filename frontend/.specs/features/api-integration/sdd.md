# SDD — Integração do Frontend com o Backend (`api-integration`)

> **Status do documento:** Spec técnica proposta para camada de serviços e conexão das telas em `frontend/`.

## 1. Organização de arquivos no `frontend/`

Aproveitando os diretórios já existentes (`frontend/services/`, `frontend/lib/` e `frontend/components/`):

```text
frontend/
├── services/
│   ├── api-client.ts          # Fetch wrapper, CSRF, retry com /auth/refresh e ApiClientError
│   ├── auth.service.ts        # csrf, requestMfa, validateMfa, register, login, refresh, logout
│   ├── users.service.ts       # getMe
│   ├── accounts.service.ts    # list, getById (com ?month=MM/YYYY), create, update, deactivate, reactivate, remove
│   ├── categories.service.ts  # list, getById, create, update, deactivate, reactivate, remove
│   └── transactions.service.ts # list (filtros + paginação + meta), getById, create, confirm, remove
├── hooks/ (ou lib/)
│   ├── use-auth-session.ts    # Contexto/hook leve para usuário autenticado (/users/me) e logout
│   └── formatters.ts          # Helpers compartilhados (formatCurrencyBRL, formatDisplayCurrency, preferências de ocultar valores)
└── components/ & app/
    ├── app-shell.tsx          # Exibe nome/e-mail reais de /users/me e aciona authService.logout()
    ├── ui/smoke-login.tsx     # Chama authService.requestMfa(...) e repassa challengeId/nextAttemptAt
    ├── ui/smoke-mfa-verify.tsx # Chama authService.validateMfa(...) e redireciona conforme isRegistered
    ├── ui/smoke-register.tsx  # Chama authService.register(...) usando cookie de onboarding
    ├── app/accounts/...       # Substitui accounts-mock-store por accountsService + transactionsService
    ├── app/categories/...     # Substitui categories-mock-store por categoriesService
    └── app/transactions/...   # Substitui mocks por transactionsService + accountsService + categoriesService
```

---

## 2. Cliente HTTP e Segurança (`frontend/services/api-client.ts`)

### 2.1. Configuração de URL e credenciais
- `API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"`.
- Toda requisição usa `credentials: "include"` e `Content-Type: "application/json"` (quando há body JSON).

### 2.2. Proteção CSRF
- O backend define o cookie não-HttpOnly/legível ou de CSRF (`AUTH_COOKIE_NAMES.csrf`) em `GET /api/v1/auth/csrf` e valida `x-csrf-token` nas rotas mutáveis (`POST`, `PATCH`, `PUT`, `DELETE`).
- Antes de qualquer requisição mutável:
  1. Ler o token do cookie de CSRF em `document.cookie` (ou cache em memória);
  2. Se ausente, chamar `GET /api/v1/auth/csrf` (`{ data: { token } }`) e armazenar em memória;
  3. Enviar `headers["x-csrf-token"] = token`.

### 2.3. Envelope de resposta e erros
- Sucesso: extrair `{ data, meta }` conforme `backend/src/shared/presentation/http/success-response.ts` (ou `undefined` em `204 No Content`).
- Erro: ler `{ error: { code, message, details } }` e lançar `ApiClientError(status, code, message, details)`.
- Se `status === 401` (e não for rota de login/refresh/mfa):
  1. Aguardar uma promise única de `refreshSession()` (`POST /api/v1/auth/refresh`);
  2. Se `204`, repetir a requisição original 1 vez;
  3. Se falhar, redirecionar para `/login`.

---

## 3. Contratos de tipos e mapeamento por módulo

### 3.1. Autenticação (`auth.service.ts` + `users.service.ts`)
- `requestMfa({ email })` → `POST /api/v1/auth/request-mfa` → `{ sent, challengeId, expiresInSeconds, nextAttemptAt }` (guardar `challengeId` e `nextAttemptAt` em `sessionStorage` junto ao e-mail pendente em `auth-onboarding-storage.ts` para sobreviver à navegação `/login` → `/login/mfa`).
- `validateMfa({ challengeId, code })` → `POST /api/v1/auth/validate-mfa` → `{ isRegistered, nextStep }`:
  - `isRegistered === true`: redireciona para `/accounts`;
  - `isRegistered === false`: redireciona para `/register`.
- `register(payload)` → `POST /api/v1/auth/register` → redireciona para `/accounts` (ou `/login` conforme fluxo de sessão).
- `getMe()` → `GET /api/v1/users/me` → popula usuário no `AppShell`.
- `logout()` → `POST /api/v1/auth/logout` → limpa estado e redireciona para `/login`.

### 3.2. Contas (`accounts.service.ts`)
- `listAccounts(params)`: `GET /api/v1/accounts` (`status`, `type`, `search`, `page`, `pageSize`).
- `getAccountDetail(accountId, month?)`: `GET /api/v1/accounts/:accountId?month=MM/YYYY` → retorna `AccountDetailResponseDto` com `metrics` (`income`, `expense`, `netResult`, `projectedBalance`, `pending`, `monthlySeries`, `categorySpend`).
- `createAccount`, `updateAccount`, `deactivateAccount`, `reactivateAccount`, `deleteAccount`.
- **Adaptação em `/accounts` e `/accounts/[accountId]`:**
  - Na tela `/accounts`, `AccountPreviewPanel` carrega `getAccountDetail(selectedId)` + `listTransactions({ accountId: selectedId, pageSize: 5, sortBy: "transactionDate", sortOrder: "desc" })` ao selecionar uma conta.
  - Na tela `/accounts/[accountId]`, trocar o `<Select>` de competência dispara `getAccountDetail(accountId, selectedMonth)` (`MM/YYYY`) + `listTransactions({ accountId, dateFrom, dateTo, ... })`.
  - A preferência visual `hideValues` (botão olho) permanece salva em `localStorage` no cliente.

### 3.3. Categorias (`categories.service.ts`)
- `listCategories(params)`: `GET /api/v1/categories` (`status`, `search`, `page`, `pageSize`).
- `createCategory`, `updateCategory`, `deactivateCategory`, `reactivateCategory`, `deleteCategory`.
- **Adaptação em `/categories`:**
  - Usar `status` (`ACTIVE` | `INACTIVE` | omitido para `ALL`) e `search` diretamente na API, respeitando `isDefault: true` (sem ações de edição/exclusão).

### 3.4. Transações (`transactions.service.ts`)
- `listTransactions(params)`: `GET /api/v1/transactions` (`page`, `pageSize`, `status`, `accountId`, `categoryId`, `dateFrom`, `dateTo`, `search`, `sortBy`, `sortOrder`) → retorna `{ items, meta }` (`totalIncome`, `totalExpense`, `netResult`, `pendingIncomeAmount`, `pendingIncomeCount`, `page`, `pageSize`, `total`, `totalPages`).
- `getTransactionById`, `createTransaction`, `confirmTransaction`, `deleteTransaction`.
- **Adaptação em `/transactions`:**
  - Cards de métrica lêem `meta` retornado pelo backend (`AnimatedMetricNumber`).
  - Formulário de lançamento carrega contas ativas (`listAccounts({ status: "ACTIVE", pageSize: 100 })`) e categorias ativas (`listCategories({ status: "ACTIVE", pageSize: 100 })`).
  - Nomes/cores/ícones de conta e categoria na tabela e no `TransactionDetailDialog` são resolvidos por lookup em mapas `Map<id, Account | Category>` carregados na página.

---

## 4. Cuidados de UX e compatibilidade

- **Estado de carregamento:** usar estados `isLoading` com feedback discreto nos cards/tabelas para evitar flicker ao trocar filtros.
- **CORS e variáveis de ambiente:** garantir que `CORS_ALLOWED_ORIGINS` no `backend/.env` inclua a origem do frontend (`http://localhost:3000`) e `NEXT_PUBLIC_API_URL` no `frontend/.env.local` aponte para o backend.
- **Remoção segura dos mocks:** só remover `accounts-mock-store.tsx`, `categories-mock-store.tsx` e dados mockados de `transaction-catalog.ts` depois que todas as telas estiverem migradas e compilando (`yarn lint` e `yarn build`).
