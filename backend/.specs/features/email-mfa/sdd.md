# SDD — Fluxo de autenticação MFA por e-mail (Backend)

## 1. Visão arquitetural

A funcionalidade estende o módulo `auth` (`backend/src/modules/auth`) e os
contratos compartilhados de e-mail e erro (`backend/src/shared`), preservando a
fronteira com o módulo `users` via métodos públicos de `UserService`.

Componentes envolvidos:

- **Persistência (`prisma/schema.prisma` + nova migration):** adaptação de
  `Challenge` e `ChallengeSubjectType` para suportar desafios direcionados por
  e-mail sem usuário prévio (`subjectId` opcional, `targetEmail`, `nextAttemptAt`).
- **Domínio (`auth/domain`):** atualização de `Challenge`, `ChallengeSubjectType`,
  `ChallengeProps`, `ChallengeMetadata`, `IChallengeRepository` e novas constantes
  de TTL/cooldown.
- **Aplicação (`auth/application`):** métodos `requestMfa` e `validateMfa` em
  `AuthService`, DTOs de entrada/saída, extensão de `JwtProvider` para `issuer`
  e tokens de onboarding, e extensão de `EmailProvider` para `sendMfaCode`.
- **Infraestrutura (`auth/infrastructure` e `shared/infrastructure`):** queries
  adicionais em `PrismaChallengeRepository`, `issuer` e onboarding em
  `JsonWebTokenProvider`, template e envio em `ResendEmailProvider` /
  `AuthEmailTemplates`.
- **Apresentação (`auth/presentation` e `shared/presentation`):** schemas Zod
  de `request-mfa` e `validate-mfa`, rotas Express com `validateCsrf` e
  `sendSuccess`, cookie `__Secure-mc_onboarding` em `auth-cookies.ts`, e código
  `ErrorCode.RATE_LIMIT_EXCEEDED` em `app-error.ts`.

---

## 2. Banco de dados e migrations

### 2.1. Alterações em `backend/prisma/schema.prisma`

```prisma
enum ChallengeSubjectType {
  USER
  MESSAGING_IDENTITY
  EMAIL
}

model Challenge {
  id            String               @id @default(uuid()) @db.Uuid
  purpose       ChallengePurpose
  subjectType   ChallengeSubjectType @map("subject_type")
  subjectId     String?              @map("subject_id") @db.Uuid
  targetEmail   String?              @map("target_email")
  secretHash    String               @unique @map("secret_hash")
  status        ChallengeStatus      @default(REQUESTED)
  attempts      Int                  @default(0)
  maxAttempts   Int                  @map("max_attempts")
  metadata      Json
  expiresAt     DateTime             @map("expires_at")
  nextAttemptAt DateTime?            @map("next_attempt_at")
  consumedAt    DateTime?            @map("consumed_at")
  createdAt     DateTime             @default(now()) @map("created_at")
  updatedAt     DateTime             @updatedAt @map("updated_at")

  @@index([subjectType, subjectId])
  @@index([status, expiresAt])
  @@index([purpose, targetEmail, createdAt])
  @@map("challenges")
}
```

### 2.2. Regras obrigatórias da migration (`backend/.specs/README.md`)

Todas as migrations **anteriores** permanecem intactas. A nova migration
(exemplo de pasta: `YYYYMMDDHHMMSS_add_email_mfa_challenge_fields`) deve seguir
estritamente:

1. **`migration.sql` (UP dentro de `BEGIN; ... COMMIT;`):**
   - `ALTER TYPE "ChallengeSubjectType" ADD VALUE IF NOT EXISTS 'EMAIL';`
     *(Atenção no PostgreSQL: `ALTER TYPE ... ADD VALUE` não pode ser usado na
     mesma transação em que o novo valor é referenciado em DDL/DML; se não
     houver DML usando `'EMAIL'` na própria migration, pode ficar fora ou recriar
     o enum dentro da transação com `ChallengeSubjectType_new`, conforme o padrão
     já utilizado em `20261114230600_drop_password_reset_requests/migration.sql`.)*
   - `ALTER TABLE "challenges" ALTER COLUMN "subject_id" DROP NOT NULL;`
   - `ALTER TABLE "challenges" ADD COLUMN "target_email" TEXT, ADD COLUMN "next_attempt_at" TIMESTAMP(3);`
   - `ALTER TABLE "challenges" ADD CONSTRAINT "challenges_subject_target_check" CHECK (("subject_type"::text = 'EMAIL' AND "target_email" IS NOT NULL AND "subject_id" IS NULL) OR ("subject_type"::text <> 'EMAIL' AND "subject_id" IS NOT NULL AND "target_email" IS NULL));`
   - `CREATE INDEX "challenges_purpose_target_email_created_at_idx" ON "challenges"("purpose", "target_email", "created_at");`
   - `INSERT` idempotente na tabela `"_prisma_migrations"` verificando
     `to_regclass('public._prisma_migrations') IS NOT NULL` e ausência de
     registro ativo com o mesmo `migration_name` (`rolled_back_at IS NULL`).
   - Comentário ao final de `migration.sql` referenciando o arquivo `down.sql` na
     mesma pasta.

2. **`down.sql` (na mesma pasta da migration):**
   - Executado em transação (`BEGIN; ... COMMIT;`):
   - Remover registros incompatíveis antes de restaurar `NOT NULL` ou remover
     o enum (ex.: `DELETE FROM "challenges" WHERE "subject_id" IS NULL OR "subject_type"::text = 'EMAIL';`);
   - `DROP INDEX IF EXISTS "challenges_purpose_target_email_created_at_idx";`
   - `ALTER TABLE "challenges" DROP CONSTRAINT IF EXISTS "challenges_subject_target_check";`
   - `ALTER TABLE "challenges" DROP COLUMN "next_attempt_at", DROP COLUMN "target_email";`
   - `ALTER TABLE "challenges" ALTER COLUMN "subject_id" SET NOT NULL;`
   - Reverter o enum `ChallengeSubjectType` para `('USER', 'MESSAGING_IDENTITY')`;
   - `DELETE FROM "_prisma_migrations" WHERE "migration_name" = '<nome_da_migration>';`

### 2.3. Atualização obrigatória de Seed e Reset

De acordo com `backend/.specs/README.md`, toda migration exige revisão e
atualização dos scripts de seed e reset do projeto (atualmente localizados em
`backend/prisma/scripts/data/demo-data.ts`, `backend/prisma/scripts/seed/seed.ts`,
`backend/prisma/scripts/database-maintenance.ts` e `backend/prisma/scripts/reset/reset.ts`):

- Garantir que `createDemoHistory` em `backend/prisma/scripts/data/demo-data.ts`
  preencha os novos campos opcionais (`targetEmail: null`, `nextAttemptAt: null`)
  ou inclua fixture de desafio `EMAIL_VERIFICATION` expirado com `subjectId: null`
  e `targetEmail` sintético (`@example.com`) para validar o novo formato no seed;
- Confirmar que `resetApplicationData` continua limpando `challenges` sem erros
  e respeitando `RESET_TABLES`.

---

## 3. Constantes, erros, cookies e contratos

### 3.1. Constantes (`auth.constants.ts`)

```typescript
export const EMAIL_MFA_CODE_TTL_MS = 5 * 60 * 1000;          // 5 minutos
export const EMAIL_MFA_MAX_ATTEMPTS = 3;                     // Tentativas de validação
export const EMAIL_MFA_RESEND_COOLDOWN_MS = 45 * 1000;       // 45 segundos entre envios
export const EMAIL_MFA_WINDOW_TTL_MS = 15 * 60 * 1000;       // Janela de 15 minutos
export const EMAIL_MFA_MAX_REQUESTS_PER_WINDOW = 3;          // Máximo 3 envios em 15 min
export const ONBOARDING_TOKEN_TTL_MS = 15 * 60 * 1000;       // 15 minutos
```

### 3.1.1. Mapa rígido de políticas por fluxo (`challenge-policies.ts`)

Para tornar a tabela genérica `challenges` explícita e segura contra usos
incorretos, criar `backend/src/modules/auth/domain/constants/challenge-policies.ts`
com um mapa exaustivo `CHALLENGE_FLOW_POLICIES` tipado com
`satisfies Record<ChallengePurpose, ChallengeFlowPolicy>`:

- Cada `ChallengePurpose` (`PASSWORD_RESET`, `ACCOUNT_REACTIVATION`,
  `EMAIL_VERIFICATION` e `MESSAGING_IDENTITY_VERIFICATION`) declara:
  - `flowName`: descrição em português do fluxo;
  - `allowedSubjectTypes`: quais `ChallengeSubjectType` são aceitos;
  - `identifierMode`: `"subjectId"` ou `"targetEmail"`;
  - `secretFormat`: `"opaque-token"` ou `"numeric-otp-6"`;
  - `ttlMs`, `maxAttempts` e `rateLimit` (`{ cooldownMs, windowMs, maxRequestsPerWindow } | null`).
- O construtor da entidade `Challenge` valida as invariantes consultando
  `CHALLENGE_FLOW_POLICIES[this.purpose]`, rejeitando combinações incompatíveis
  de `subjectType`, `subjectId` e `targetEmail`.
- `AuthService` e `PrismaChallengeRepository` consomem os limites (`ttlMs`,
  `maxAttempts`, `rateLimit`) diretamente de `CHALLENGE_FLOW_POLICIES`.

### 3.2. Novo código de erro HTTP (`app-error.ts`)

Adicionar `RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"` ao enum `ErrorCode` em
`backend/src/shared/presentation/http/app-error.ts` para representar bloqueios
HTTP `429` no padrão de erro da aplicação.

### 3.3. Cookies `HttpOnly` (`auth-cookies.ts`)

```typescript
export const AUTH_COOKIE_NAMES = {
  access: "__Secure-mc_access",
  refresh: "__Secure-mc_refresh",
  csrf: "__Secure-mc_csrf",
  onboarding: "__Secure-mc_onboarding",
} as const;

export const AUTH_COOKIE_PATHS = {
  access: "/api/v1",
  refresh: "/api/v1/auth",
  csrf: "/api/v1",
  onboarding: "/api/v1/auth",
} as const;
```

- `ONBOARDING_COOKIE_OPTIONS`: `httpOnly: true`, `secure: true`,
  `sameSite: "none"`, `path: AUTH_COOKIE_PATHS.onboarding`,
  `maxAge: ONBOARDING_TOKEN_TTL_MS`.
- Helpers adicionais em `auth-cookies.ts`:
  - `setOnboardingCookie(response: Response, onboardingToken: string): void`
  - `clearOnboardingCookie(response: Response): void`

### 3.4. JWT com `issuer` e payload de onboarding (`jsonwebtoken.provider.ts` e `auth.contracts.ts`)

- Configurar `issuer` em `JsonWebTokenProvider` (ex.: `process.env.JWT_ISSUER ?? "minha-carteira-api"`), aplicado em `jwt.sign` (`issuer`) e validado em `jwt.verify` (`issuer`).
- Novo método em `JwtProvider`:
  - `signOnboardingToken(subject: { email: string; challengeId: string }): Promise<{ token: string; payload: OnboardingTokenClaims }>`
  - `verifyOnboardingToken(token: string): Promise<VerifiedOnboardingToken>`
- Claims do **JWT de onboarding** (`type: "onboarding"`):
  - `sub`: `email` normalizado
  - `cid`: `challengeId`
  - `type`: `"onboarding"`
  - `iss`: `issuer` configurado
  - `jti`: UUID v4
  - `iat` e `exp`: emissão e expiração (`iat + 900s` = 15 minutos)
- Claims do **JWT de acesso** (`type: "access"`, quando `isRegistered === true`):
  - Mantém `{ sid: sessionId, type: "access" }`, `subject: userId`, `jwtid`,
    `issuer`, `expiresIn: 900` (15 minutos).
- O método de assinatura de acesso pode retornar também as claims decodificadas
  (ou haver helper `decodePayload` interno confiável após `sign`) para
  persistência do payload decodificado em `Challenge.metadata`.

### 3.5. `ChallengeMetadata` (`auth.interfaces.ts`)

```typescript
export interface IssuedTokenMetadata {
  jti: string;
  sub: string;
  iss: string;
  type: "access" | "onboarding";
  iat: number;
  exp: number;
  sid?: string;
  cid?: string;
  isRegistered: boolean;
}

export interface ChallengeMetadata {
  issued: RequestMetadata;
  consumed: RequestMetadata | null;
  tokenPayload?: IssuedTokenMetadata | null;
}
```

> **Regra de segurança:** `Challenge.metadata` armazena **somente** as claims
> decodificadas (`tokenPayload`) para auditoria e rastreabilidade; o token JWT
> assinado completo **nunca** deve ser persistido no banco nem em logs.

### 3.6. Hash do código de 6 dígitos (`secretHash`)

Como há apenas `1.000.000` códigos possíveis (`000000`–`999999`) e a coluna
`challenges.secret_hash` possui constraint `@unique`, o hash nunca deve ser
calculado apenas sobre os 6 dígitos isolados.

- Utilizar `hashMfaSecret(challengeId, code)`:
  `HMAC-SHA256(key = process.env.JWT_SECRET, data = "${challengeId}:${code}")`
  (ou `Sha256TokenHasher.hash("${challengeId}:${code}")` quando sem chave HMAC
  separada, preferindo HMAC com segredo do servidor).
- A comparação deve continuar ocorrendo em tempo constante (`timingSafeEqual`).

### 3.7. `EmailProvider` e `UserService`

- Em `backend/src/shared/application/interfaces/auth-emails.interfaces.ts`:
  ```typescript
  export interface MfaCodeEmail {
    email: string;
    code: string;
    expiresInMinutes: number;
  }
  ```
- Em `EmailProvider` (`email-provider.contract.ts`) e `ResendEmailProvider`:
  - `sendMfaCode(input: MfaCodeEmail): Promise<void>`
  - Template correspondente em `AuthEmailTemplates` informando o código de 6
    dígitos e validade de 5 minutos, sem exibir informações sensíveis em logs.
- Em `UserService` (`users.service.ts`):
  - Novo método de consulta para o módulo `auth`:
    `findAuthStatusByEmail(email: string): Promise<{ id: string; status: UserStatus } | null>`
    para distinguir usuário inexistente (`null`), ativo (`ACTIVE`) ou inativo
    (`INACTIVE`) sem expor `passwordHash` nem importar `IUsersRepository` em `auth`.

---

## 4. Contratos HTTP e fluxos detalhados

### 4.1. `POST /api/v1/auth/request-mfa`

#### Contrato HTTP
- **Middlewares:** `validateCsrf` (exige origem permitida e token/cookie CSRF,
  igual às demais rotas `POST` públicas de `auth.routes.ts`).
- **Body (`requestMfaSchema`):**
  ```json
  {
    "email": "voce@exemplo.com",
    "metadata": {
      "deviceId": "web-client-123",
      "location": { "latitude": -23.55, "longitude": -46.63 }
    }
  }
  ```
  - `email`: string obrigatória, validada como e-mail, `trim().toLowerCase()`.
  - `metadata`: opcional, usando `requestMetadataSchema`.
- **Resposta `200 OK` (`sendSuccess`):**
  ```json
  {
    "data": {
      "sent": true,
      "challengeId": "550e8400-e29b-41d4-a716-446655440000",
      "nextAttemptAt": "2026-11-15T03:50:45.000Z"
    }
  }
  ```
- **Erros esperados:**
  - `400 VALIDATION_ERROR`: e-mail ou metadata inválidos.
  - `429 RATE_LIMIT_EXCEEDED`: cooldown ativo (`nextAttemptAt > now`) ou limite
    de 3 envios na janela de 15 minutos atingido. Mensagem em português
    informando o motivo e `details: { nextAttemptAt }`.
  - `502 INTERNAL_ERROR`: falha na entrega pelo `ResendEmailProvider`.

#### Fluxo passo a passo
1. **Entrada:** Express recebe `POST /api/v1/auth/request-mfa`, valida CSRF e
   monta `RequestMetadata` com `buildRequestMetadata` (`userAgent` do header
   `user-agent`, `ipAddress` de `request.ip`, `deviceId` e `location` do body).
2. **Validação:** `requestMfaSchema.safeParse(request.body)` valida e normaliza
   `email`.
3. **Caso de uso (`AuthService.requestMfa`):**
   - Executa em transação (`this.prisma.$transaction`) com lock/serialização por
     `targetEmail` (ou consulta + `pg_advisory_xact_lock` derivado do e-mail)
     para evitar corrida em cliques duplos:
   - Busca o último desafio `EMAIL_VERIFICATION` para `targetEmail`. Se
     `latest?.nextAttemptAt && latest.nextAttemptAt > now`, lança erro de rate
     limit (`429`) informando `latest.nextAttemptAt`.
   - Conta quantos desafios `EMAIL_VERIFICATION` foram criados para
     `targetEmail` com `createdAt >= now - 15min`. Se `count >= 3`, garante que
     o bloqueio respeite `now + 15min` (a partir do último desafio) e lança
     erro `429`.
   - Expira eventuais desafios `REQUESTED` anteriores daquele `targetEmail`
     (`status = EXPIRED`, `updatedAt = now`).
   - Calcula `nextAttemptAt`: se `count + 1 >= 3`, `now + 15min`; caso
     contrário, `now + 45s`.
   - Gera `challengeId = randomUUID()` e código aleatório de 6 dígitos com
     `crypto.randomInt(0, 1_000_000).toString().padStart(6, "0")`.
   - Gera `secretHash` vinculando `challengeId:code`, instancia `Challenge` com
     `purpose: EMAIL_VERIFICATION`, `subjectType: EMAIL`, `subjectId: null`,
     `targetEmail`, `maxAttempts: 3`, `expiresAt: now + 5min`, `nextAttemptAt`,
     `metadata: { issued: snapshotMetadata(metadata), consumed: null }`.
4. **Módulos e persistência:** salva o `Challenge` via `PrismaChallengeRepository`
   e envia o e-mail via `EmailProvider.sendMfaCode({ email, code, expiresInMinutes: 5 })`.
   Se o envio falhar, chama `challengeRepository.markFailed(challengeId, new Date())`
   e propaga o erro.
5. **Resposta:** `sendSuccess(response, { sent: true, challengeId, nextAttemptAt: nextAttemptAt.toISOString() })`.

> **Nota sobre `trust proxy`:** validar no `createApp` / `server.ts` se
> `trust proxy` deve ser configurado atrás de proxy reverso para que
> `request.ip` registre o IP real do cliente no campo `metadata`.

---

### 4.2. `POST /api/v1/auth/validate-mfa`

#### Contrato HTTP
- **Middlewares:** `validateCsrf`.
- **Body (`validateMfaSchema`):**
  ```json
  {
    "challengeId": "550e8400-e29b-41d4-a716-446655440000",
    "code": "482910",
    "metadata": {
      "deviceId": "web-client-123",
      "location": null
    }
  }
  ```
  - `challengeId`: UUID válido obrigatório.
  - `code`: string numérica exata de 6 dígitos (`/^\d{6}$/`).
  - `metadata`: opcional (`requestMetadataSchema`).
- **Resposta `200 OK` (`sendSuccess`):**
  ```json
  {
    "data": {
      "accessToken": "<jwt>",
      "isRegistered": false
    }
  }
  ```
  - **Cookies gravados quando `isRegistered === false`:**
    - `__Secure-mc_onboarding=<onboardingJwt>` (`HttpOnly`, `Secure`,
      `SameSite=None`, `Path=/api/v1/auth`, `Max-Age=900`).
  - **Cookies gravados quando `isRegistered === true`:**
    - `__Secure-mc_access=<accessJwt>` (`HttpOnly`, `Secure`, `SameSite=None`,
      `Path=/api/v1`, `Max-Age=900`).
    - `__Secure-mc_refresh=<refreshJwt>` (`HttpOnly`, `Secure`, `SameSite=None`,
      `Path=/api/v1/auth`, `Max-Age=432000`).
    - Limpa `__Secure-mc_onboarding` caso exista no navegador.
- **Erros esperados:**
  - `400 VALIDATION_ERROR`: formato inválido de `challengeId`, `code` ou `metadata`.
  - `401 UNAUTHORIZED`: desafio inexistente, expirado, já consumido, com
    tentativas esgotadas ou `code` incorreto (`"Código de verificação inválido ou expirado."`).
  - `403 FORBIDDEN`: o `targetEmail` pertence a uma conta `INACTIVE`.

#### Fluxo passo a passo
1. **Entrada:** Express valida CSRF e constrói `RequestMetadata` com
   `buildRequestMetadata`.
2. **Validação:** `validateMfaSchema.safeParse(request.body)` valida UUID e
   código de 6 dígitos.
3. **Caso de uso (`AuthService.validateMfa`):**
   - Busca `Challenge` por `challengeId`. Verifica `challenge.purpose === EMAIL_VERIFICATION`,
     `challenge.subjectType === EMAIL`, `Boolean(challenge.targetEmail)` e
     `challenge.isUsableAt(now)`. Se falhar, lança `401`.
   - Compara o código contra `challenge.secretHash` usando `challengeId:code`.
     - Se não conferir: executa `registerInvalidAttemptForPurpose` (incrementa
       `attempts` e marca como `FAILED` se atingir `maxAttempts = 3`) e lança
       `401`.
   - Consulta `userService.findAuthStatusByEmail(challenge.targetEmail)`:
     - Se existir e `status === "INACTIVE"`: lança `403 FORBIDDEN` sem consumir o
       desafio com sessão nem gravar cookies.
     - Se existir e `status === "ACTIVE"` (`isRegistered = true`):
       - Gera `sessionId = randomUUID()`, assina `accessToken` (`type: "access"`,
         15 min, com `issuer`) e `refreshToken` (5 dias);
       - Cria entidade `RefreshToken` (`userAgent` e `ipAddress` preenchidos a
         partir de `metadata`) e persiste na mesma transação do consumo do desafio.
     - Se não existir (`isRegistered = false`):
       - Assina `onboardingToken` (`type: "onboarding"`, 15 min, com `issuer`,
         `sub: targetEmail`, `cid: challengeId`).
4. **Módulos e persistência:** dentro de `prisma.$transaction`:
   - Chama `completeIfUsableForPurpose` marcando `status = COMPLETED`,
     `consumedAt = now` e gravando `metadata`:
     ```json
     {
       "issued": { "...RequestMetadata" },
       "consumed": { "...RequestMetadata" },
       "tokenPayload": { "jti": "...", "sub": "...", "iss": "...", "type": "...", "iat": 0, "exp": 0, "isRegistered": false }
     }
     ```
   - Se `isRegistered === true`, salva o `RefreshToken` na mesma transação.
5. **Resposta:**
   - Se `isRegistered === true`, chama `setAuthenticationCookies(response, accessToken, refreshToken)` e `clearOnboardingCookie(response)`.
   - Se `isRegistered === false`, chama `setOnboardingCookie(response, accessToken)`.
   - Retorna `sendSuccess(response, { accessToken, isRegistered })`.

---

## 5. Impactos e segurança

- **Isolamento de tokens:** `authentication.middleware.ts` rejeita automaticamente
  tokens com `type !== "access"`, e o cookie `__Secure-mc_onboarding` fica
  restrito a `/api/v1/auth`. Assim, um usuário novo autenticado no pré-cadastro
  não acessa rotas privadas nem cria linhas órfãs em `refresh_tokens`.
- **Logs:** seguir os padrões estruturados de logging em português sem registrar
  código OTP, `secretHash`, JWT completo ou e-mail sem sanitização indevida.
- **Compatibilidade retroativa:** os fluxos `PASSWORD_RESET` e
  `ACCOUNT_REACTIVATION` continuam operando normalmente com `subjectType = USER`
  e `subjectId` preenchido.
