# Módulo de contas financeiras (`accounts`)

> **Status da spec:** Aprovada para a estrutura base do módulo `accounts` (CRUD completo e ciclo de vida `ACTIVE`/`INACTIVE`), independente de `transactions`. Rotas de últimas transações e métricas/gráficos por conta serão especificadas e implementadas após a criação do módulo `transactions`.

## Objetivo

Permitir que cada usuário autenticado cadastre, consulte, edite, desative/reative e exclua suas próprias contas financeiras (`CHECKING`, `CASH`, `DIGITAL`, `SAVINGS`, `INVESTMENT`), mantendo isolamento estrito por usuário (proteção contra IDOR), precisão decimal no PostgreSQL, reutilização integral dos contratos globais da API e compatibilidade com a interface já construída no frontend.

## Escopo

### Incluído nesta etapa (`accounts` base)

- Modelagem da tabela `accounts` no PostgreSQL via Prisma (`Account`, `AccountType`, `AccountStatus`);
- Enums `AccountType` e `AccountStatus`;
- Entidade de domínio `Account`, interface `IAccountRepository`, DTOs de entrada/saída, mapper, `AccountsService`, `PrismaAccountRepository`, schemas Zod, `AccountsController` e rotas versionadas sob `/api/v1/accounts`;
- Operações HTTP completas:
  - Criar conta (`POST /api/v1/accounts`);
  - Listar contas do usuário com paginação global, filtros e saldo consolidado (`GET /api/v1/accounts`);
  - Buscar conta por ID (`GET /api/v1/accounts/:accountId`);
  - Atualizar dados cadastrais/visuais editáveis (`PATCH /api/v1/accounts/:accountId`);
  - Desativar conta (`PATCH /api/v1/accounts/:accountId/deactivate`);
  - Reativar conta (`PATCH /api/v1/accounts/:accountId/reactivate`);
  - Excluir conta fisicamente (`DELETE /api/v1/accounts/:accountId`);
- Atualização dos scripts de manutenção em `backend/prisma/scripts/` e cobertura com testes unitários e de integração.

### Fora do escopo desta etapa (pós-criação de `transactions`)

- Listagem de últimas transações vinculadas à conta (`transactions`);
- Endpoints de fluxo mensal (`Entradas vs Saídas`) e gastos por categoria por competência (`YYYY-MM`);
- Atualização transacional automática de `currentBalance` ao confirmar/estornar/excluir lançamentos.

## Decisões confirmadas

1. **Saldos e precisão monetária:**
   - `initialBalance` e `currentBalance` são persistidos no PostgreSQL com `@db.Decimal(14, 2)`.
   - Na API JSON (DTOs de entrada e saída), valores monetários trafegam como `number` (com no máximo 2 casas decimais).
   - `initialBalance` **não pode ser negativo** (`>= 0`).
   - Na criação da conta, `currentBalance` inicia igual a `initialBalance`.
   - `initialBalance` é **imutável** após a criação da conta (não pode ser alterado via `PATCH /api/v1/accounts/:accountId`), preservando a base de auditoria e futuro recálculo.
2. **Tipo, bandeira, instituição e cor:**
   - `type`: obrigatório (`CHECKING`, `CASH`, `DIGITAL`, `SAVINGS`, `INVESTMENT`).
   - `brand` (bandeira): opcional (`string | null`), aceitando qualquer texto curto (até 60 caracteres), compatível com os padrões do frontend (`visa`, `mastercard`, `elo`, `hipercard`) e com futuros valores personalizados ("Outros").
   - `institution` (instituição financeira): opcional (`string | null`, até 80 caracteres).
   - `color`: opcional (`string | null`), validado e salvo no formato hexadecimal `#RRGGBB` (`^#[0-9A-Fa-f]{6}$`).
3. **Ciclo de vida e exclusão real (sem soft delete):**
   - `status`: `ACTIVE` | `INACTIVE`, acompanhado de `inactivatedAt DateTime?`.
   - Rotas dedicadas de ciclo de vida (Opção A): `PATCH /api/v1/accounts/:accountId/deactivate` e `PATCH /api/v1/accounts/:accountId/reactivate`.
   - Não existe coluna `deletedAt`. Toda exclusão é **exclusão física real (`DELETE`)**.
   - **Campo calculado `transactionsCount` e preparação para futuras transações (decisões 2 e 3.4 confirmadas):**
     - `transactionsCount` **não é uma coluna na tabela `accounts`**; é um campo calculado retornado no DTO (`AccountResponseDto`) para informar ao frontend quantos lançamentos estão vinculados à conta (permitindo habilitar/desabilitar o botão de exclusão e exibir os contadores na interface).
     - Enquanto o módulo `transactions` não existir, o repositório expõe o método preparatório `countLinkedTransactions(accountId, userId)` retornando `0`, permitindo exclusão física normalmente. Quando `transactions` for implementado, o método passará a contar os registros reais na tabela de transações e `DELETE /api/v1/accounts/:accountId` retornará `409 Conflict` automaticamente sempre que `transactionsCount > 0`.
4. **Unicidade de nome entre contas ativas:**
   - Um usuário não pode possuir duas contas **ativas** (`status = ACTIVE`) com o mesmo nome (comparação com `trim()` e case-insensitive).
   - Contas `INACTIVE` não bloqueiam o cadastro ou renomeação de uma conta `ACTIVE` com o mesmo nome, mas a reativação de uma conta `INACTIVE` é bloqueada (`409 Conflict`) caso já exista outra conta `ACTIVE` com o mesmo nome normalizado.
5. **Relação com `User` (`onDelete: Cascade`) e índices:**
   - A FK `userId` em `accounts` usa `onDelete: Cascade` (exclusão real em cascata quando um registro de `users` for removido fisicamente).
   - Índices compostos iniciando por `userId` (`[userId, status]`, `[userId, type, status]`, `[userId, inactivatedAt]`), além do índice único parcial para nomes ativos.
6. **Segurança e prevenção contra IDOR:**
   - Todas as rotas exigem autenticação via middleware global (`createAuthenticationMiddleware`) e validação CSRF nas mutações (`createCsrfValidationMiddleware`).
   - Toda consulta ou operação sobre `:accountId` filtra obrigatoriamente por `{ id: accountId, userId }` extraído do token/sessão autenticada, retornando `404` quando a conta não existir ou pertencer a outro usuário.
7. **Reutilização estrita dos contratos globais:**
   - Paginação via `parsePagination` e `createPaginationMeta` (`backend/src/shared/presentation/http/pagination.ts`), sem sobrescrever ou recriar helpers.
   - Respostas HTTP via `sendSuccess`, `sendCreated` e `sendNoContent` (`backend/src/shared/presentation/http/success-response.ts`).
   - Erros via `AppError` e `ErrorCode` (`backend/src/shared/presentation/http/app-error.ts`) com mensagens em português brasileiro.
   - Na listagem (`GET /api/v1/accounts`), `meta` reaproveita `createPaginationMeta` e inclui o somatório consolidado das contas ativas (`totalBalance`, `activeCount`, `inactiveCount`).
8. **Sem `currency` e sem `includeInTotal`:**
   - Sistema opera em BRL no escopo atual (sem coluna `currency`); todas as contas `ACTIVE` do usuário compõem `totalBalance`.

## Melhorias correlatas mapeadas para o frontend (etapa seguinte de UI)

- Adicionar opção de seletor de cor personalizado (paleta livre `#RRGGBB`) mantendo as 8 cores rápidas já exibidas em `account-form-dialog.tsx`.
- Adicionar opção **"Outros"** no seletor de bandeira (`brand`) com campo de texto livre mantendo os padrões (`Visa`, `Mastercard`, `Elo`, `Hipercard`).

## Critérios de aceite

- [ ] Schema Prisma e migration (`UP`/`DOWN`) válidos com `yarn prisma:validate` e `yarn prisma:generate`.
- [ ] Camada de domínio pura (`AccountType`, `AccountStatus`, `Account`, `IAccountRepository`) sem dependências de Prisma ou Express.
- [ ] Contratos globais (`pagination.ts`, `success-response.ts`, `app-error.ts`) reutilizados integralmente sem duplicação.
- [ ] Endpoints versionados sob `/api/v1/accounts` protegidos contra acessos não autenticados, CSRF e IDOR (`userId` isolado).
- [ ] Listagem retorna registros paginados e `totalBalance` consolidado das contas ativas do usuário.
- [ ] Tentativa de editar `initialBalance` via `PATCH` rejeitada pela validação HTTP, e tentativa de criar/renomear/reativar com nome duplicado entre contas `ACTIVE` retorna `409 Conflict`.
- [ ] Testes unitários e de integração passando em `backend/`.
