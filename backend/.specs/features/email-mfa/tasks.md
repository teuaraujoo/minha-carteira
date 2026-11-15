# Fluxo de MFA por e-mail (Backend)

## Objetivo
Implementar no backend o fluxo completo de solicitação (`POST /api/v1/auth/request-mfa`) e validação (`POST /api/v1/auth/validate-mfa`) de código MFA de 6 dígitos enviado por e-mail, incluindo adaptação da tabela `challenges` com `targetEmail` e `nextAttemptAt`, rate limit persistido, emissão de JWT de 15 minutos e gravação de cookies `HttpOnly` para usuários novos e já cadastrados.

## Restrições globais
- Escopo restrito ao backend: não alterar o frontend nem integrar as telas `/login`, `/login/mfa` e `/register` nesta entrega.
- Não alterar o comportamento ou contrato atual de `POST /api/v1/auth/register`.
- Manter as migrations anteriores intactas.
- Toda nova migration deve seguir `backend/.specs/README.md`: transação `BEGIN; ... COMMIT;`, registro idempotente em `_prisma_migrations`, arquivo `down.sql` com referência comentada ao final de `migration.sql` e atualização dos scripts de seed/reset.
- Mensagens de erro, logs e comentários de código devem estar em português brasileiro.
- Utilizar Yarn 4 dentro de `backend` (`yarn prisma:generate`, `yarn prisma:validate`, testes e typecheck), sem `npm`/`npx` e sem rodar migrations em produção.
- Não faça commit antes de revisão
- implemente tudo na branch atual, sem criar branch nova nem worktree

## Pontos de atenção
- `secretHash` possui constraint `@unique` na tabela `challenges`: na implementação atual, o hash vincula `${challengeId}:${code}` via SHA-256 (`Sha256TokenHasher` com `createHash("sha256")` e comparação via `timingSafeEqual`, sem segredo HMAC) para evitar colisões entre códigos numéricos de 6 dígitos.
- `attempts` / `maxAttempts` controla exclusivamente tentativas inválidas de validação no `validate-mfa`; o limite de 3 pedidos em 15 minutos e o cooldown de 45 segundos do `request-mfa` utilizam `nextAttemptAt` e contagem na janela de 15 minutos.
- `Challenge.metadata.tokenPayload` armazena apenas as claims decodificadas do JWT emitido (`sub`, `iss`, `jti`, `iat`, `exp`, `type` e `sid` para `access` ou `cid` para `onboarding`), nunca a string assinada do token.
- No ambiente atual, os scripts de seed e reset estão em `backend/prisma/scripts/` (`seed/seed.ts`, `reset/reset.ts`, `data/demo-data.ts`, `database-maintenance.ts`).

---

## Task 1: Schema Prisma, migration (UP/DOWN) e atualização de seed/reset

**Arquivos:**
- Modificar:
  - `backend/prisma/schema.prisma`
  - `backend/prisma/scripts/data/demo-data.ts`
- Conferido (sem necessidade de alteração):
  - `backend/prisma/scripts/database-maintenance.ts`
- Criar:
  - `backend/prisma/migrations/20261115010600_add_email_mfa_challenge_fields/migration.sql`
  - `backend/prisma/migrations/20261115010600_add_email_mfa_challenge_fields/down.sql`

**Passos:**
- [x] Adicionar `EMAIL` ao enum `ChallengeSubjectType` em `backend/prisma/schema.prisma`.
- [x] Tornar `Challenge.subjectId` opcional (`String? @db.Uuid`), adicionar `targetEmail String? @map("target_email")` e `nextAttemptAt DateTime? @map("next_attempt_at")`, além do índice `@@index([purpose, targetEmail, createdAt])`.
- [x] Criar `migration.sql` dentro de `BEGIN; ... COMMIT;` com as alterações DDL, a constraint `CHECK` `challenges_subject_target_check` (exigindo `target_email` sem `subject_id` para `EMAIL`, e `subject_id` sem `target_email` para os demais tipos), `INSERT` idempotente em `"_prisma_migrations"` e comentário final referenciando `down.sql`.
- [x] Criar `down.sql` revertendo índice, constraint `challenges_subject_target_check`, colunas, `NOT NULL` em `subject_id` (após limpar registros `EMAIL` / `subject_id IS NULL`), enum `ChallengeSubjectType` e removendo o registro em `"_prisma_migrations"`.
- [x] Atualizar `backend/prisma/scripts/data/demo-data.ts` (e conferir `database-maintenance.ts`) para refletir os novos campos (`targetEmail`, `nextAttemptAt` e registro de exemplo `EMAIL_VERIFICATION`) no seed e no reset.
- [x] Executar `yarn prisma:validate` em `backend` (e Prisma Client gerado em `backend/generated/prisma/` compatível com `targetEmail`, `nextAttemptAt`, `subjectId` nullable e `ChallengeSubjectType.EMAIL`).

**Pronto quando:**
- `yarn prisma:validate` e `yarn prisma:generate` concluem sem erros, o Prisma Client reflete `targetEmail`, `nextAttemptAt`, `subjectId` nullable e `ChallengeSubjectType.EMAIL`, e os scripts de seed/reset permanecem compatíveis.

**Commit sugerido:**
`feat(auth): add target_email and next_attempt_at to challenges schema`

---

## Task 2: Domínio de `Challenge`, mapa de políticas, repositório e erro `RATE_LIMIT_EXCEEDED`

**Arquivos:**
- Criar:
  - `backend/src/modules/auth/domain/constants/challenge-policies.ts`
- Modificar:
  - `backend/src/shared/presentation/http/app-error.ts`
  - `backend/src/modules/auth/domain/constants/auth.constants.ts`
  - `backend/src/modules/auth/domain/enums/auth.enums.ts`
  - `backend/src/modules/auth/domain/interfaces/auth.interfaces.ts`
  - `backend/src/modules/auth/domain/entities/challenge.entity.ts`
  - `backend/src/modules/auth/domain/interfaces/challenge-repository.interface.ts`
  - `backend/src/modules/auth/infrastructure/repositories/challenge.repository.ts`

**Passos:**
- [x] Adicionar `RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"` em `ErrorCode` (`app-error.ts`).
- [x] Adicionar em `auth.constants.ts` as constantes do MFA (`MFA_CODE_TTL_MS`, `MFA_MAX_ATTEMPTS`, `MFA_RESEND_COOLDOWN_MS`, `MFA_RATE_LIMIT_WINDOW_MS`, `MFA_RATE_LIMIT_MAX_REQUESTS`, `MFA_CODE_LENGTH`, `ONBOARDING_TOKEN_TTL_MS`).
- [x] Adicionar `EMAIL = "EMAIL"` em `ChallengeSubjectType` (`auth.enums.ts`).
- [x] Criar `challenge-policies.ts` com o mapa exaustivo `CHALLENGE_FLOW_POLICIES` (`Record<ChallengePurpose, ChallengeFlowPolicy>`), mapeando todos os fluxos que utilizam `challenges` (`PASSWORD_RESET`, `ACCOUNT_REACTIVATION`, `EMAIL_VERIFICATION`, `MESSAGING_IDENTITY_VERIFICATION`), seus `allowedSubjectTypes`, `requiresSubjectId`, `requiresTargetEmail`, `codeTtlMs`, `maxAttempts`, `resendCooldownMs`, `rateLimitWindowMs` e `maxRequestsInWindow`.
- [x] Atualizar `ChallengeProps`, `ChallengeMetadata` (`tokenPayload?: ChallengeTokenPayloadMetadata | null | undefined`) e validar no construtor da entidade `Challenge` (`subjectId: string | null`, `targetEmail: string | null`, `nextAttemptAt: Date | null`) as invariantes definidas via `assertChallengeMatchesPolicy`.
- [x] Adicionar ao `IChallengeRepository` e implementar no `PrismaChallengeRepository` os métodos de suporte ao MFA (`findLatestByPurposeAndEmail`, `countByPurposeAndEmailSince`, `invalidateOpenByPurposeAndEmail`, além dos métodos por finalidade `registerInvalidAttemptForPurpose`, `completeIfUsableForPurpose` e `markFailed`).

**Pronto quando:**
- Domínio e repositório compilam no TypeScript mantendo compatibilidade com os fluxos existentes de `PASSWORD_RESET` e `ACCOUNT_REACTIVATION`.

**Commit sugerido:**
`feat(auth): extend challenge domain and repository for email mfa`

---

## Task 3: JWT (`issuer` + onboarding), cookies e e-mail de código MFA

**Arquivos:**
- Modificar:
  - `backend/src/modules/auth/application/contracts/auth.contracts.ts`
  - `backend/src/modules/auth/infrastructure/security/jsonwebtoken.provider.ts`
  - `backend/src/modules/auth/presentation/security/auth-cookies.ts`
  - `backend/src/shared/application/interfaces/auth-emails.interfaces.ts`
  - `backend/src/shared/application/contracts/email-provider.contract.ts`
  - `backend/src/shared/infrastructure/providers/email/auth-email-templates.ts`
  - `backend/src/shared/infrastructure/providers/email/resend-email.provider.ts`
  - `backend/src/modules/users/application/services/users.service.ts`
- Criar:
  - `backend/src/shared/infrastructure/providers/email/templates/mfa-code.html`

**Passos:**
- [x] Atualizar `JsonWebTokenProvider` (e contrato `JwtProvider`) para incluir e validar `issuer` (`JWT_ISSUER ?? "minha-carteira-api"`), emitir/verificar tokens de onboarding (`type: "onboarding"`, 15 min, `sub: email`, `cid: challengeId`) e retornar as claims decodificadas (`VerifiedToken` e `VerifiedOnboardingToken`) para auditoria.
- [x] Adicionar o cookie dedicado `__Secure-mc_onboarding` (`path: "/api/v1/auth"`, `httpOnly: true`, `secure: true`, `sameSite: "none"`, `maxAge: ONBOARDING_TOKEN_TTL_MS`) e helpers `setOnboardingCookie` / `clearOnboardingCookie` em `auth-cookies.ts`.
- [x] Estender `EmailProvider`, `auth-emails.interfaces.ts`, `AuthEmailTemplates` (carregando `templates/mfa-code.html`) e `ResendEmailProvider` com `sendMfaCode({ email, code, expiresInMinutes })`.
- [x] Expor `findAuthStatusByEmail(email)` em `UserService` para consulta do módulo `auth`.

**Pronto quando:**
- JWT com `issuer` e onboarding, cookie dedicado, envio do código MFA via `ResendEmailProvider` e consulta de status em `UserService` compilam e possuem testes unitários passando.

**Commit sugerido:**
`feat(auth): add onboarding jwt, mfa email template and cookies`

---

## Task 4: Casos de uso `requestMfa` / `validateMfa` e rotas HTTP

**Arquivos:**
- Modificar:
  - `backend/src/modules/auth/application/services/auth.service.ts`
  - `backend/src/modules/auth/presentation/schemas/auth.schemas.ts`
  - `backend/src/modules/auth/presentation/routes/auth.routes.ts`
- Criar:
  - `backend/src/modules/auth/application/dto/mfa.dto.ts`

**Passos:**
- [x] Criar schemas Zod `requestMfaSchema` (`{ email, metadata? }`) e `validateMfaSchema` (`{ challengeId, code, metadata? }`) em `auth.schemas.ts`.
- [x] Implementar `AuthService.requestMfa` consumindo os limites de `CHALLENGE_FLOW_POLICIES[ChallengePurpose.EMAIL_VERIFICATION]`, com lock transacional por e-mail (`pg_advisory_xact_lock`), validação de `nextAttemptAt` (45s entre os 3 envios e 15min após o 3º envio com HTTP `429`), expiração de desafio `REQUESTED` anterior, geração de código numérico de 6 dígitos (`generateNumericOtp` via `crypto.randomInt`), cálculo de `secretHash` via `Sha256TokenHasher` sobre `${challengeId}:${code}`, `expiresAt = now + 5min`, persistência e envio via `EmailProvider.sendMfaCode` (marcando `FAILED` se o e-mail falhar).
- [x] Implementar `AuthService.validateMfa` validando desafio utilizável, conferindo `secretHash`, registrando tentativa inválida quando o código divergir, tratando conta `INACTIVE` (`403`), emitindo sessão + `RefreshToken` (`isRegistered: true`) ou token de onboarding (`isRegistered: false`), e gravando `consumedAt`, `consumed` (`RequestMetadata`) e `tokenPayload` (claims decodificadas) no `metadata` do desafio.
- [x] Completar `router.post("/request-mfa", validateCsrf, ...)` e `router.post("/validate-mfa", validateCsrf, ...)` em `auth.routes.ts`, gravando cookies adequados (`__Secure-mc_onboarding` vs `__Secure-mc_access` + `__Secure-mc_refresh` limpando onboarding) e respondendo via `sendSuccess`.

**Pronto quando:**
- Ambas as rotas respeitam CSRF, envelope `{ data }`, validação Zod, coleta de `RequestMetadata` e todos os fluxos descritos no `sdd.md`.

**Commit sugerido:**
`feat(auth): implement request-mfa and validate-mfa endpoints`

---

## Task 5: Testes automatizados e verificação final

**Arquivos:**
- Criados / Modificados:
  - `backend/test/auth/challenge-policies.test.ts`
  - `backend/test/auth/email-mfa.service.test.ts`
  - `backend/test/auth/auth-routes-mfa.test.ts`
  - `backend/test/auth/jsonwebtoken.provider.test.ts`
  - `backend/test/auth/resend-email.provider.test.ts`
  - `backend/test/prisma/database-maintenance.test.ts`
  - `backend/test/prisma/demo-data.test.ts`

**Passos:**
- [x] Testar invariantes de `Challenge` com `CHALLENGE_FLOW_POLICIES` (rejeição de `subjectType`, `subjectId` ou `targetEmail` incompatíveis com o `purpose`).
- [x] Testar `requestMfa`: emissão inicial (`nextAttemptAt = now + 45s`), 2º envio após 45s invalidando desafio anterior, bloqueio `429` antes de `nextAttemptAt`, bloqueio `429` de 15 min no 3º envio na janela e marcação `FAILED` quando envio de e-mail falha.
- [x] Testar `validateMfa`: código inválido incrementa `attempts` e bloqueia ao atingir `maxAttempts = 3`; desafio expirado retorna `400` (`VALIDATION_ERROR`); usuário novo retorna `{ accessToken, isRegistered: false }` + cookie `__Secure-mc_onboarding` sem criar `RefreshToken`; usuário ativo retorna `{ accessToken, isRegistered: true }` + cookies `__Secure-mc_access` e `__Secure-mc_refresh` + `RefreshToken` salvo; usuário inativo retorna `403`; `metadata` contém `issued`, `consumed` e `tokenPayload` sem token assinado.
- [ ] Executar suíte de testes e `tsc --noEmit` via Yarn 4 em `backend`: os 38 testes de MFA/auth/JWT/Resend/Prisma passam (`tsx --test`), e `src/` + os novos arquivos de teste MFA não possuem erros de tipo; porém `yarn tsc --noEmit` global ainda falha em arquivos de teste legados desatualizados (`test/auth/account-reactivation.use-case.test.ts`, `auth.routes.test.ts`, `authentication.middleware.test.ts`, `login.use-case.test.ts`, `password-reset.use-case.test.ts`, `refresh-session.use-case.test.ts`, `test/users/*`, `test/logging/users-service-logging.test.ts`).

**Pronto quando:**
- Todos os testes automatizados e a verificação TypeScript em `backend` passam sem falhas nem avisos de tipo.

**Commit sugerido:**
`test(auth): cover request-mfa and validate-mfa flows`
