# Fluxo de autenticação MFA por e-mail (Backend)

## Objetivo

Disponibilizar no backend os endpoints `POST /api/v1/auth/request-mfa` e
`POST /api/v1/auth/validate-mfa` para suportar o fluxo de verificação por código
numérico de 6 dígitos enviado via e-mail, atendendo tanto novos usuários em
pré-cadastro quanto usuários ativos já registrados.

## Resultado esperado

- Solicitação de código MFA por e-mail com proteção de rate limit persistida no
  PostgreSQL (`nextAttemptAt` + janela de 15 minutos com limite de 3 pedidos e
  cooldown de 45 segundos entre pedidos);
- Persistência do desafio na tabela `challenges` com suporte a pré-cadastro
  (sem usuário existente em `users`), utilizando `ChallengePurpose.EMAIL_VERIFICATION`
  e `ChallengeSubjectType.EMAIL`;
- Validação do código de 6 dígitos via `{ challengeId, code }` com controle de
  tentativas inválidas (`attempts` / `maxAttempts`);
- Verificação da existência do usuário em `users` a partir do `targetEmail` do
  desafio, diferenciando usuário novo (`isRegistered: false`) de usuário
  cadastrado (`isRegistered: true`);
- Emissão de JWT com expiração curta de 15 minutos e claims padrão (`iss`,
  `sub`, `jti`, `iat`, `exp`) e gravação de cookies `HttpOnly` nos dois cenários
  (cookie dedicado de onboarding para usuário novo; cookies de sessão +
  `RefreshToken` persistido para usuário já cadastrado);
- Envio do código MFA por e-mail usando `EmailProvider` / `ResendEmailProvider`;
- Registro completo de `metadata` da requisição (`deviceId`, `userAgent`,
  `ipAddress`, `location`) e do payload decodificado do JWT emitido no
  `metadata` do desafio.

## Decisões confirmadas

1. **Identificação do desafio no `validate-mfa`:** o cliente envia
   `{ challengeId, code }` (e `request-mfa` retorna `{ sent, challengeId, nextAttemptAt }`).
2. **Propósito e sujeito do desafio:** reutilizar `ChallengePurpose.EMAIL_VERIFICATION`,
   adicionar `ChallengeSubjectType.EMAIL`, tornar `Challenge.subjectId` opcional
   (`String? @db.Uuid`) e adicionar `targetEmail` indexado + `nextAttemptAt` em
   `challenges`.
3. **Cooldown e janela de envio (`request-mfa`):** máximo de **3 pedidos a cada
   15 minutos** por `targetEmail`, com intervalo mínimo de **45 segundos** entre
   os envios (`nextAttemptAt = now + 45s` no 1º e 2º envios da janela;
   `nextAttemptAt = now + 15min` no 3º envio da janela).
4. **Reenvio enquanto desafio anterior ainda está válido (`< 5 min`):** se
   `now >= nextAttemptAt` e o limite de 3 pedidos em 15 minutos não foi
   atingido, invalidar o desafio `REQUESTED` anterior (`EXPIRED`) antes de criar
   o novo desafio com `expiresAt = now + 5min`. Se `now < nextAttemptAt`,
   rejeitar com HTTP `429`.
5. **Separação entre `attempts` e reenvios:** `attempts` / `maxAttempts` na
   tabela `challenges` permanece exclusivo para tentativas inválidas de código
   no `validate-mfa` (padrão `maxAttempts = 3`); o rate limit de envios usa
   `nextAttemptAt` + contagem de desafios criados nos últimos 15 minutos.
6. **Hash do código:** o `secretHash` deve ser calculado vinculando
   `challengeId:code` (com segredo/HMAC ou composição com `challengeId`),
   evitando colisão na constraint `@unique` de `secret_hash`.
7. **Cookies e tokens nos dois cenários do `validate-mfa`:**
   - **Usuário novo (`isRegistered: false`):** emite JWT de onboarding
     (`type: "onboarding"`, TTL 15 min) com `sub = targetEmail` e `cid = challengeId`,
     grava cookie `HttpOnly` dedicado `__Secure-mc_onboarding` (restrito ao
     path `/api/v1/auth`) sem criar `RefreshToken` nem emitir cookies de sessão.
   - **Usuário ativo já cadastrado (`isRegistered: true`):** cria `RefreshToken`
     no banco, emite `accessToken` (`type: "access"`, TTL 15 min) e
     `refreshToken`, grava os cookies `HttpOnly` `__Secure-mc_access` e
     `__Secure-mc_refresh` (e limpa `__Secure-mc_onboarding` se presente).
   - Em ambos os casos o DTO de saída retorna `{ accessToken, isRegistered }`.

## Escopo

### Incluído

- Alteração do schema Prisma (`Challenge`, `ChallengeSubjectType`) e criação de
  nova migration seguindo integralmente as regras de `backend/.specs/README.md`
  (UP com `_prisma_migrations`, DOWN em `down.sql` e atualização de seed/reset);
- Implementação de `POST /api/v1/auth/request-mfa` e
  `POST /api/v1/auth/validate-mfa` no módulo `auth`;
- Adição de `ErrorCode.RATE_LIMIT_EXCEEDED` para respostas HTTP `429`;
- Suporte a `issuer` (`iss`) e token de onboarding em `JwtProvider` /
  `JsonWebTokenProvider`;
- Suporte ao cookie `__Secure-mc_onboarding` em `auth-cookies.ts`;
- Extensão de `EmailProvider`, `ResendEmailProvider` e `AuthEmailTemplates` para
  envio do código MFA de 6 dígitos (`sendMfaCode`);
- Método de consulta de usuário por e-mail para decisão `isRegistered` respeitando
  a fronteira entre os módulos `auth` e `users`;
- Testes unitários e de rotas HTTP simuladas cobrindo emissão, rate limit,
  expiração, tentativas inválidas, usuário novo, usuário ativo e usuário inativo.

### Fora do escopo (Backlog)

- Integração do frontend (`/login`, `/login/mfa`, `/register`) com as novas
  rotas do backend;
- Adaptação do endpoint `POST /api/v1/auth/register` para exigir/extrair o
  e-mail verificado do cookie `__Secure-mc_onboarding` (permanece inalterado
  nesta tarefa);
- Login social (Google OAuth);
- Rotina agendada de limpeza de desafios expirados (`AUTH-15` / backlog geral).

## Requisitos funcionais

### MFA-RF-001 — Solicitação de código (`POST /api/v1/auth/request-mfa`)

- Deve aceitar `{ email, metadata? }`, normalizando `email` (`trim().toLowerCase()`).
- Deve coletar `userAgent`, `ipAddress`, `deviceId` e `location` via
  `buildRequestMetadata`.
- Deve verificar os desafios `EMAIL_VERIFICATION` do `targetEmail`:
  - Se o desafio mais recente possuir `nextAttemptAt > now`, deve rejeitar com
    HTTP `429` (`ErrorCode.RATE_LIMIT_EXCEEDED`).
  - Deve contar quantos desafios `EMAIL_VERIFICATION` foram criados para o
    `targetEmail` na janela `[now - 15min, now]`; se já houver `3` ou mais, deve
    rejeitar com HTTP `429`.
- Deve marcar desafios `REQUESTED` anteriores daquele `targetEmail` como `EXPIRED`
  antes de persistir o novo desafio.
- Deve gerar código numérico aleatório de 6 dígitos (`000000`–`999999`), calcular
  `secretHash` a partir de `challengeId:code`, definir `expiresAt = now + 5min`,
  `maxAttempts = 3` e `nextAttemptAt`:
  - `now + 45s` quando for o 1º ou 2º pedido nos últimos 15 minutos;
  - `now + 15min` quando atingir o 3º pedido nos últimos 15 minutos.
- Deve enviar o código por e-mail via `EmailProvider.sendMfaCode`. Em caso de
  falha no envio, deve marcar o desafio como `FAILED` e propagar erro sem
  retornar falso sucesso.
- Deve retornar HTTP `200` com envelope `{ data: { sent: true, challengeId, nextAttemptAt } }`.

### MFA-RF-002 — Validação de código (`POST /api/v1/auth/validate-mfa`)

- Deve aceitar `{ challengeId, code, metadata? }` (com `challengeId` UUID e
  `code` numérico de 6 dígitos).
- Deve buscar o desafio por `challengeId` e validar: `purpose === EMAIL_VERIFICATION`,
  `subjectType === EMAIL` e `isUsableAt(now)`.
- Se o código não corresponder ao `secretHash`, deve registrar tentativa
  inválida (`registerInvalidAttemptForPurpose`) e retornar erro HTTP `400` ou
  `401` padronizado.
- Ao validar o código:
  - Consultar o módulo `users` por `challenge.targetEmail`:
    - **Usuário inativo (`INACTIVE`):** não consumir o desafio para login nem
      emitir cookie de onboarding ou sessão; rejeitar com erro `403 FORBIDDEN`
      orientando reativação.
    - **Usuário ativo (`ACTIVE`):** `isRegistered = true`, criar `RefreshToken`,
      emitir `accessToken` (`type: "access"`, 15 min) e `refreshToken`, gravar
      cookies `__Secure-mc_access` e `__Secure-mc_refresh` (e limpar
      `__Secure-mc_onboarding`).
    - **Usuário inexistente:** `isRegistered = false`, emitir JWT de onboarding
      (`type: "onboarding"`, 15 min, `sub: targetEmail`, `cid: challenge.id`),
      gravar cookie dedicado `__Secure-mc_onboarding` (sem `refresh_token`).
  - Consumir o desafio atomicamente (`status = COMPLETED`, `consumedAt = now`),
    salvando em `metadata` os dados de `consumed` (`RequestMetadata`) e o
    `tokenPayload` com as claims decodificadas do JWT emitido (nunca o token
    assinado).
- Deve retornar HTTP `200` com envelope `{ data: { accessToken, isRegistered } }`.

## Critérios de aceite

- [ ] Schema Prisma e nova migration (`migration.sql` + `down.sql`) criados
      seguindo integralmente `backend/.specs/README.md`, mantendo migrations
      antigas inalteradas.
- [ ] Scripts de manutenção/seed/reset atualizados e compatíveis com o novo
      schema (`backend/prisma/scripts/`).
- [ ] `POST /api/v1/auth/request-mfa` respeita CSRF, envelope `{ data }`, TTL de
      5 min, cooldown de 45s e bloqueio de 15 min após 3 envios (`429`).
- [ ] `POST /api/v1/auth/validate-mfa` respeita CSRF, envelope `{ data }`,
      controle de `attempts`/`maxAttempts`, persistência de `consumedAt` e
      `metadata` (com payload JWT decodificado), e emissão correta de cookies nos
      cenários `isRegistered: false` e `isRegistered: true`.
- [ ] `POST /api/v1/auth/register` e rotas de frontend não foram modificados
      nesta entrega.
- [ ] Testes automatizados e verificação TypeScript executados e passando.
