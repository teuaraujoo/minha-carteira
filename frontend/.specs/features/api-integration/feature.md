# Integração do Frontend com as Rotas do Backend (`api-integration`)

> **Status da spec:** Proposta pronta para revisão e implementação no frontend (`frontend/`).

## Objetivo

Substituir os armazenamentos e fluxos simulados em memória no frontend (`accounts-mock-store`, `categories-mock-store`, `transaction-catalog` e delays simulados de autenticação) pela integração real com a API HTTP do backend (`/api/v1/*`), utilizando cookies `HttpOnly`, proteção CSRF, renovação automática de sessão (`refresh`) e tratamento padronizado de erros em português brasileiro.

## Mapeamento de cobertura: Backend vs Telas atuais do Frontend

Todas as telas ativas do frontend possuem rotas correspondentes prontas no backend:

| Tela / Componente (`frontend/`) | Rotas do Backend (`backend/src/app/app.ts`) | Observações de integração |
| :--- | :--- | :--- |
| `/login` (`SmokeLogin`) | `GET /api/v1/auth/csrf`, `POST /api/v1/auth/request-mfa`, `POST /api/v1/auth/login` | Fluxo principal atual envia e-mail para MFA (`/request-mfa` → `/login/mfa`); opcionalmente pode suportar login com senha (`/login`). |
| `/login/mfa` (`SmokeMfaVerify`) | `POST /api/v1/auth/validate-mfa`, `POST /api/v1/auth/request-mfa` | Usuário já cadastrado recebe cookies de sessão e vai para `/accounts`; usuário novo recebe cookie de onboarding e vai para `/register`. |
| `/register` (`SmokeRegister`) | `POST /api/v1/auth/register` | Usa o cookie `HttpOnly` de onboarding emitido no `/validate-mfa` e redireciona após conclusão. |
| `AppShell` (sessão e cabeçalho) | `GET /api/v1/users/me`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout` | Carrega perfil autenticado, renova `accessToken` automaticamente em `401` e encerra sessão no logout. |
| `/accounts` (`AccountsPage` + `AccountPreviewPanel` + `AccountFormDialog`) | `GET /api/v1/accounts`, `POST /api/v1/accounts`, `PATCH /api/v1/accounts/:accountId`, `/deactivate`, `/reactivate`, `DELETE /api/v1/accounts/:accountId` | Ao selecionar uma conta na pilha/grade, o painel lateral consulta `GET /api/v1/accounts/:accountId` (métricas do mês) e `GET /api/v1/transactions?accountId=...&pageSize=5` (últimas movimentações). |
| `/accounts/[accountId]` (`AccountDetailView`) | `GET /api/v1/accounts/:accountId?month=MM/YYYY`, `GET /api/v1/transactions?accountId=...`, `PATCH /api/v1/accounts/:accountId`, `/deactivate`, `/reactivate`, `DELETE` | Consome `data.metrics` (`income`, `expense`, `netResult`, `projectedBalance`, `pending`, `monthlySeries`, `categorySpend`) diretamente do backend. |
| `/categories` (`CategoriesPage` + `CategoryFormDialog`) | `GET /api/v1/categories`, `POST /api/v1/categories`, `PATCH /api/v1/categories/:categoryId`, `/deactivate`, `/reactivate`, `DELETE` | Listagem paginada/filtrada por `status` e `search`; categorias `isDefault: true` permanecem somente leitura. |
| `/transactions` (`TransactionsPage` + `TransactionFormDialog` + `TransactionDetailDialog`) | `GET /api/v1/transactions`, `POST /api/v1/transactions`, `GET /api/v1/transactions/:transactionId`, `PATCH /api/v1/transactions/:transactionId/confirm`, `DELETE` | Usa filtros na URL (`status`, `accountId`, `categoryId`, `dateFrom`, `dateTo`, `search`, `sortBy`, `sortOrder`, `page`, `pageSize`) e exibe totais de `meta`. |

### Fora do escopo desta etapa

- Implementação de novas telas ainda em placeholder no frontend (`/`, `/budgets`, `/recurring-transactions`, `/profile`, `/settings`);
- Alterações em contratos ou rotas do backend (todos os endpoints necessários já estão implementados).

## Decisões arquiteturais e requisitos

1. **Cliente HTTP único com `credentials: "include"` e CSRF automático:**
   - Centralizar todas as chamadas em `frontend/services/api-client.ts` utilizando `NEXT_PUBLIC_API_URL` (fallback `http://localhost:3333` em desenvolvimento).
   - Enviar sempre `credentials: "include"` para trafegar os cookies `HttpOnly` (`access`, `refresh`, `onboarding`, `csrf`).
   - Para requisições mutáveis (`POST`, `PATCH`, `PUT`, `DELETE`), ler o cookie CSRF (ou obtê-lo via `GET /api/v1/auth/csrf` caso ausente) e enviar no header `x-csrf-token`.
2. **Renovação automática de sessão (`refresh`) e redirecionamento:**
   - Ao receber `401 UNAUTHORIZED` em rotas protegidas (exceto `/auth/login`, `/auth/refresh`, `/auth/validate-mfa`), executar uma única chamada `POST /api/v1/auth/refresh` (compartilhada via lock de promise para evitar múltiplas chamadas simultâneas) e repetir a requisição original.
   - Se o `refresh` falhar, limpar estado de sessão no cliente e redirecionar para `/login`.
3. **Preservação da UI e tratamento de erros:**
   - Manter a experiência visual atual (incluindo `.page-fade-in` com blur, `AnimatedMetricNumber` e `react-hot-toast` para feedback de sucesso/erro usando `error.message` retornado pela API).
   - Manter estados de carregamento (`loading` / skeleton discreto ou disabled nos botões) sem quebrar SSR/hidratação do Next.js.

## Critérios de aceite

- [ ] Nenhum dado financeiro exibido nas telas `/accounts`, `/accounts/[accountId]`, `/categories` e `/transactions` depende de arrays estáticos mockados.
- [ ] Fluxo completo de login via MFA (`/login` → `/login/mfa` → `/register` ou `/accounts`) funciona com cookies `HttpOnly` e header `x-csrf-token`.
- [ ] Criação, edição, ativação/desativação e exclusão de contas e categorias persistem no PostgreSQL via API e refletem imediatamente na interface.
- [ ] Lançamento, filtragem/paginação, detalhes, confirmação e exclusão lógica de transações funcionam ponta a ponta com atualização dos saldos e métricas da conta.
- [ ] `yarn lint` e `yarn build` passam em `frontend/` sem erros ou avisos.
