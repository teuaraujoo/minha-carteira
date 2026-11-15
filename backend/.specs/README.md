# Specs do backend

## Estrutura obrigatória de todas as specs

Toda especificação de funcionalidade (`.specs/features/<nome-da-feature>/`) **deve** conter obrigatoriamente **3 arquivos**:

1. `feature.md` — visão de negócio, escopo funcional, decisões confirmadas/pendentes e critérios de aceite.
2. `sdd.md` — desenho técnico (Software Design Document), arquitetura, fluxos (entrada, validação, caso de uso, módulos, persistência e resposta), contratos e SQL/schemas.
3. `tasks.md` — plano de execução passo a passo seguindo estritamente o template abaixo.

### Padrão obrigatório para o arquivo `tasks.md`

```markdown
# <Título>

## Objetivo
<Descrição clara do objetivo da entrega>

## Restrições globais
- <Restrição 1>
- <Restrição 2>

## Pontos de atenção
- <Ponto de atenção, se houver>

---

## Task 1: <Título da Task>

**Arquivos:**
- Modificar:
  - `caminho/do/arquivo.ts`
- Criar:
  - `caminho/do/novo.arquivo.ts`

**Passos:**
- [ ] Passo 1
- [ ] Passo 2

**Pronto quando:**
- <Critério objetivo de conclusão e verificação>

**Commit sugerido:**
`feat(escopo): mensagem em ingles no padrao conventional commits`
```

### Regra obrigatória para todas as migrations (`_prisma_migrations` + UP e DOWN)

Como nem sempre as migrations são executadas via CLI do Prisma (podendo ser aplicadas diretamente por query SQL no banco de dados), **toda migration criada deve obrigatoriamente conter**:

1. **UP (`migration.sql`):**
   - As instruções DDL/DML de aplicação da migration dentro de uma transação (`BEGIN; ... COMMIT;`).
   - Um `INSERT` idempotente na tabela `_prisma_migrations` registrando a aplicação da migration caso a tabela exista e o `migration_name` ainda não esteja registrado como aplicado (`rolled_back_at IS NULL`).
2. **DOWN (`down.sql` na mesma pasta + referência comentada ao final de `migration.sql`):**
   - As instruções SQL exatas de reversão da migration.
   - A remoção/atualização correspondente na tabela `_prisma_migrations` (`DELETE FROM "_prisma_migrations" WHERE "migration_name" = '<nome_da_migration>';`).

**Exemplo padrão de registro em `_prisma_migrations` (no UP):**
```sql
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT
  gen_random_uuid()::text,
  'manual_sql_<nome_da_migration>',
  NOW(),
  '<nome_da_migration>',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '<nome_da_migration>'
      AND "rolled_back_at" IS NULL
  );
```

3. **Atualização obrigatória dos scripts de Seed e Reset:**
   - Toda vez que uma alteração incluir criação ou modificação de **migration** (novas tabelas, colunas, constraints, tipos `ENUM` ou renomeações), é **obrigatório atualizar os scripts existentes de seed e de reset** (`backend/scripts/lib/staging.seed.ts`, `backend/scripts/seed.staging.ts`, `backend/scripts/lib/database.reset.ts` e `backend/scripts/reset.database.ts`) para refletir o novo schema.
   - Os scripts de seed e reset operam com base nas variáveis de conexão definidas no `.env` (`DATABASE_URL`, mantendo suporte a `STAGING_DATABASE_URL`), não sendo restritos apenas a staging.


## Como trabalhar

- Ler AGENTS.md e a spec; perguntar diante de dúvidas/decisões novas.
- Não pedir de novo confirmação já concedida; marcar decisões reais como
  **Aguardando resposta** e não tratar propostas como aprovações.
- Documentar antes do código e atualizar docs principais por implementação.
- Verificar critérios pertinentes, registrar limitações e evidências.

---

## Decisões arquiteturais e de produto dos módulos

Registro consolidado das decisões relevantes já tomadas para o desenho e implementação dos módulos do backend. Novas decisões transversais ou de impacto entre módulos devem ser adicionadas aqui após aprovação.

### 1. Decisões transversais (Arquitetura, HTTP e Segurança)

- **Arquitetura modular e fronteiras entre módulos:** Cada módulo segue a separação em `domain`, `application`, `infrastructure` e `presentation`. Domínio e aplicação não importam Express, Prisma, Zod ou SDKs externos; comunicação entre módulos ocorre exclusivamente por contratos/serviços públicos (ex.: `auth` consulta `UserService`; `users` aciona `StorageOperations`), sem acessar repositórios internos de outro módulo.
- **Versionamento e contratos globais HTTP:** Todas as rotas de negócio ficam sob `/api/v1` e reutilizam integralmente os helpers compartilhados:
  - Respostas de sucesso (`200`/`201`/`204`) no envelope `{ data, meta? }` (`sendSuccess`, `sendCreated`, `sendNoContent`);
  - Erros tipados via `AppError` e `ErrorCode` com mensagens em português brasileiro;
  - Paginação via `parsePagination` e `createPaginationMeta` (`page = 1`, `pageSize = 20`, máximo `100`).
- **Isolamento por usuário (anti-IDOR):** Toda consulta ou mutação em recurso pertencente a um usuário filtra obrigatoriamente pelo `userId` extraído da autenticação (nunca por identificador enviado no body, query ou params), retornando `404` quando o registro não pertence ao usuário autenticado.
- **Cookies `HttpOnly` e proteção CSRF:** Credenciais de sessão e onboarding trafegam exclusivamente em cookies `HttpOnly`, `Secure` e `SameSite=none` (`__Secure-mc_access` no path `/api/v1`; `__Secure-mc_refresh` e `__Secure-mc_onboarding` no path `/api/v1/auth`). Mutações exigem validação de `Origin` permitido e *Double Submit Cookie* (`__Secure-mc_csrf` comparado ao header `x-csrf-token` via `timingSafeEqual`).

### 2. Módulo `users`

- **Identidade, normalização e unicidade:** `email` e `username` passam por `trim()` + minúsculas e possuem constraints únicas no PostgreSQL. `username` rejeita `@` para não colidir com e-mail no login por `identifier`. `phone` é obrigatório no cadastro e atualização de perfil no formato brasileiro `+55` + DDD + `9` + 8 dígitos.
- **Hashing de senha:** Senhas não passam por `trim` e são armazenadas via `bcrypt` (`BcryptPasswordHasher`, `BCRYPT_SALT_ROUNDS ?? 12`), nunca expostas em DTOs ou logs.
- **Ciclo de vida e exclusão após 30 dias:** A desativação (`INACTIVE`) preserva o histórico, grava `inactivatedAt` e revoga todas as sessões (`USER_DEACTIVATED`). A exclusão definitiva (dados financeiros, sessões, identidades de mensageria, desafios e arquivos) ocorre somente após **30 dias** de inatividade sem reativação (execução agendada prevista em spec futura).

### 3. Módulo `auth` e MFA por e-mail (`email-mfa`)

- **Tokens JWT (`JsonWebTokenProvider`):** Assinados com `HS256` e validação estrita de algoritmo e `issuer` (`JWT_ISSUER ?? "minha-carteira-api"`):
  - **Access token (`type: "access"`, TTL 15 min):** claims `sub` (`userId`), `sid` (`sessionId` do `RefreshToken`), `jti`, `iss`, `iat`, `exp`.
  - **Refresh token (`type: "refresh"`, TTL 5 dias):** claims `sub` (`userId`), `sid`, `jti`, `iss`, `iat`, `exp`, persistido em `refresh_tokens` apenas como hash SHA-256 e **sem rotação** na versão atual.
  - **Onboarding token (`type: "onboarding"`, TTL 15 min):** emitido em `validate-mfa` quando o e-mail ainda não possui cadastro (`isRegistered: false`), com claims `sub` (`targetEmail` normalizado), `cid` (`challengeId`), `jti`, `iss`, `iat`, `exp`, gravado apenas no cookie `__Secure-mc_onboarding` sem criar `RefreshToken`.
- **Estrutura polimórfica da tabela `challenges`:** Centraliza desafios de `PASSWORD_RESET`, `ACCOUNT_REACTIVATION`, `EMAIL_VERIFICATION` e `MESSAGING_IDENTITY_VERIFICATION`, validados pelo mapa exaustivo `CHALLENGE_FLOW_POLICIES` e pela constraint SQL `challenges_subject_target_check`:
  - `subjectId` (`@db.Uuid`) obrigatório e `targetEmail` nulo para `USER` e `MESSAGING_IDENTITY`;
  - `targetEmail` obrigatório e `subjectId` nulo para `ChallengeSubjectType.EMAIL`;
  - Campo `nextAttemptAt` para cooldown/rate limit e `metadata` JSON com `{ issued, consumed, tokenPayload? }` (gravando apenas claims decodificadas do JWT emitido, nunca a string assinada do token).
- **Algoritmo de geração e hash do código MFA:**
  - Código numérico de **6 dígitos** gerado por CSPRNG nativo (`crypto.randomInt(0, 1_000_000)` com `.padStart(6, "0")`).
  - Armazenado em `secret_hash` usando **SHA-256** (`Sha256TokenHasher` com `createHash("sha256")` e comparação em tempo constante via `timingSafeEqual`) sobre `${challengeId}:${code}`, evitando colisões na constraint `@unique`.
- **Regras de envio, expiração e tentativas do MFA:**
  - Código válido por **5 minutos**; limite de **3 tentativas inválidas** de validação no `validate-mfa` (`attempts` / `maxAttempts`, mudando o status para `FAILED` na 3ª falha).
  - Rate limit persistido no PostgreSQL por `targetEmail` com `pg_advisory_xact_lock`: cooldown de **45 segundos** entre envios e teto de **3 pedidos em 15 minutos** (`nextAttemptAt = now + 45s` no 1º e 2º envios; `now + 15min` no 3º; bloqueios retornam `429 RATE_LIMIT_EXCEEDED`).
  - Novo envio permitido após o cooldown invalida (`EXPIRED`) o desafio `REQUESTED` anterior; falha no envio de e-mail marca o desafio como `FAILED` e retorna erro (`502`).
  - Usuário existente com status `INACTIVE` que validar o código MFA recebe `403 Forbidden` (exigindo reativação prévia).

### 4. Módulo `storage`

- **Centralização de mídia e contexto seguro:** O módulo não expõe rotas HTTP próprias e centraliza a entidade `StoredFile` (`PROCESSING -> UPLOADING -> COMPLETED | FAILED`) no Cloudflare R2. O módulo consumidor (atualmente `users` com `USER_PROFILE`) valida propriedade e informa `ownerUserId` e `contextId` internamente — nunca recebidos do cliente — e entrega arquivos privados por URLs pré-assinadas temporárias (validade de 30 minutos em `GET /users/me`).

### 5. Módulo `accounts`

- **Moeda, precisão decimal e imutabilidade:** Opera em BRL (sem coluna `currency`). `initialBalance` e `currentBalance` usam `@db.Decimal(14, 2)` no banco e trafegam como `number` na API. `initialBalance` deve ser `>= 0`, define o valor inicial de `currentBalance` e é **imutável** após a criação (`PATCH` rejeita alterações).
- **Unicidade de nome entre contas ativas:** Um usuário não pode ter duas contas `ACTIVE` com o mesmo nome (`trim()`, case-insensitive), garantido pelo índice único parcial `"accounts_user_id_active_name_key"` (`WHERE "status" = 'ACTIVE'`). Contas `INACTIVE` não impedem reutilização do nome, mas sua reativação retorna `409 Conflict` se já houver outra conta `ACTIVE` com o mesmo nome.
- **Ciclo de vida e exclusão real (sem soft delete):** Estados `ACTIVE` e `INACTIVE` alternados por rotas dedicadas (`PATCH /api/v1/accounts/:accountId/deactivate` e `.../reactivate`), sem `deletedAt`. A FK para `users` utiliza `onDelete: Cascade`.
- **Quando contas podem ser excluídas (`transactionsCount`):** A exclusão (`DELETE /api/v1/accounts/:accountId`) é física e **permitida apenas quando não há transações vinculadas (`transactionsCount === 0`)**. Enquanto o módulo `transactions` não existir, `transactionsCount` é calculado como `0` por método preparatório no repositório; com `transactions` implementado, contas com lançamentos vinculados retornarão `409 Conflict` na tentativa de exclusão (restando apenas a desativação).
- **Campos visuais e consolidação de saldo:** `brand` (até 60 caracteres, suportando os padrões do frontend e valores livres em "Outros"), `institution` (até 80 caracteres) e `color` (`#RRGGBB`) são opcionais. A listagem paginada inclui `totalBalance` consolidado com a soma de todas as contas `ACTIVE` do usuário em `meta` (sem flag `includeInTotal`).
