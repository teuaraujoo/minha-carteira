# Tarefas — módulo de autenticação

## Execution Plan

As fases são executadas na ordem indicada. Tarefas marcadas como bloqueadas
permanecem pendentes até que a decisão ou dependência seja resolvida.

### Fase 1 — Contratos e tokens

```text
T1 → T2
T1 → T3
```

### Fase 2 — Sessão e autenticação

```text
T2 → T4
T3 → T4
T2 → T5
T3 → T5
T2 → T6
T3 → T6
T6 → T7
T3 → T7
T4 → T12
T5 → T12
T6 → T12
T7 → T12
```

T4–T7 consomem o contrato público de `users` implementado em USR-09.
`T12` permanece bloqueada até definir o nome dos cookies, a estratégia CSRF e
a regra para usernames contendo `@`.

### Fase 3 — Recuperação de senha

```text
T1 → T8 → T10 → T11
T1 → T9 → T10
T9 → T11
T8 → T11
T2 → T11
```

T8–T11 permanecem bloqueadas até aprovar as políticas de recuperação. T9 também
depende de autorização para instalar o SDK Resend.

### Fase 4 — Rotas, frontend e documentação

```text
T8 → T13
T9 → T13
T10 → T13
T11 → T13
T12 → T13
T11 → T14
T12 → T15
T13 → T15
T14 → T15
T8 → T16
```

T13 contém somente as rotas de recuperação e depende da Fase 3. T14 altera o
frontend. T16 é backlog e depende de mecanismo de agendamento aprovado.

## Task Breakdown

### T1: [AUTH-01] Definir contratos e entidades

**Status:** Concluída
**What:** Definir entidades, DTOs, repositories, providers, claims e contexto
autenticado, sem dependência de bibliotecas externas no domínio.
**Where:** domínio e aplicação de `auth`.
**Depends on:** Nenhuma.
**Requirement:** AUTH-RF-002, AUTH-RF-005, AUTH-RF-006, AUTH-RF-011.

**Done when:**

- [x] Entidades e contratos não usam `any`, Prisma, Express ou JWT.
- [x] Refresh token, solicitações e desafios representam status e expiração
      definidos no design.
- [x] Testes cobrem estados, expiração e transições aplicáveis.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): define authentication contracts`

### T2: [AUTH-02] Implementar provider JWT

**Status:** Concluída
**What:** Adaptar `jsonwebtoken` ao contrato JWT e ler a chave de
`process.env.JWT_SECRET`.
**Where:** adapter de segurança de `auth`, com testes.
**Depends on:** T1.
**Requirement:** AUTH-RF-005.

**Done when:**

- [x] Algoritmo e tipo são validados explicitamente para access e refresh.
- [x] Assinatura, expiração, claims inválidas e tipos trocados são rejeitados.
- [x] Erros externos são traduzidos para erros da aplicação em português.
- [x] Testes usam segredo próprio e não dependem de `.env` local.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): add jwt provider`

### T3: [AUTH-03] Implementar persistência de refresh tokens

**Status:** Concluída; migration pendente
**What:** Implementar repository Prisma e gateway público de revogação de
sessões, mantendo integração PostgreSQL adiada até configurar a URL.
**Where:** infraestrutura e contratos públicos de `auth`; testes sem banco.
**Depends on:** T1.
**Requirement:** AUTH-RF-002, AUTH-RF-003, AUTH-RF-004.

**Done when:**

- [x] Banco guarda somente hash, datas, auditoria opcional e motivo de
      revogação.
- [x] Sessão expira em cinco dias e consultas ignoram sessões expiradas ou
      revogadas.
- [x] Revogação individual e de todas as sessões usa operações tipadas.
- [ ] Migration é preparada/revisada em código, mas não aplicada.
- [x] Testes sem banco passam; teste PostgreSQL fica registrado como pendente.

Integração PostgreSQL e migration permanecem pendentes até a configuração de
`DATABASE_URL`; nenhuma migration foi aplicada.

**Tests:** unit
**Gate:** full
**Commit:** `feat(auth): persist user sessions`

### T4: [AUTH-04] Implementar caso de uso de login

**Status:** Bloqueada pela regra de username com `@`
**What:** Validar credenciais e criar sessão usando `UsersAuthGateway`.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T2, T3 e contrato USR-09.
**Requirement:** AUTH-RF-001, AUTH-RF-002.

**Done when:**

- [ ] Entrada preserva a senha sem `trim` e normaliza somente o identificador.
- [ ] E-mail e username encontram credenciais pelo contrato público de `users`.
- [ ] Usuário ausente, senha incorreta e usuário inativo geram o mesmo erro
      público.
- [ ] Sessão guarda hash do refresh token e saída não contém tokens ou hash.
- [ ] Testes cobrem sucesso e erros indistinguíveis.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): implement user login`

### T5: [AUTH-05] Implementar refresh sem rotação

**Status:** Concluída
**What:** Validar refresh cookie, sessão, hash e usuário e emitir somente novo
access token.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T2, T3 e contrato USR-09.
**Requirement:** AUTH-RF-003.

**Done when:**

- [x] Refresh expirado, revogado, divergente ou de usuário inativo é rejeitado.
- [x] Refresh válido mantém a credencial e atualiza `lastUsedAt`.
- [x] Testes comprovam sucesso e falhas listadas.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): implement session refresh`

### T6: [AUTH-06] Implementar middleware autenticado

**Status:** Concluída
**What:** Validar access token, sessão e usuário antes de preencher o contexto
autenticado.
**Where:** middleware e extensão tipada de `Express.Request`, com testes.
**Depends on:** T2, T3 e contrato USR-09.
**Requirement:** AUTH-RF-005, AUTH-RF-006.

**Done when:**

- [x] Middleware rejeita tokens ausentes, inválidos, expirados, de tipo errado,
      revogados e usuários inativos.
- [x] Em sucesso, define `request.auth.userId` e `sessionId` corretos.
- [x] Testes cobrem cada cenário e uma rota protegida de teste.

**Tests:** unit e e2e
**Gate:** full
**Commit:** `feat(auth): add authentication middleware`

### T7: [AUTH-07] Implementar logout

**Status:** Concluída em aplicação; HTTP pendente em T12
**What:** Revogar a sessão atual de forma idempotente e remover cookies.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T3, T6.
**Requirement:** AUTH-RF-004.

**Done when:**

- [x] Sessão ativa recebe motivo `LOGOUT` e data de revogação.
- [x] Sessão inválida ou já revogada continua permitindo limpeza dos cookies.
- [ ] Resposta é 204 e refresh posterior é rejeitado.

A resposta HTTP 204 e a limpeza dos cookies dependem da integração de rotas
definida para T12; o caso de uso não controla cookies.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): implement session logout`

### T8: [AUTH-08] Implementar persistência da recuperação

**Status:** Bloqueada pelas políticas de recuperação
**What:** Implementar repositories de solicitações e desafios, metadata tipada
e consumo atômico do desafio.
**Where:** infraestrutura de `auth`, com testes sem banco.
**Depends on:** T1.
**Requirement:** AUTH-RF-007, AUTH-RF-008, AUTH-RF-009, AUTH-RF-011.

**Done when:**

- [ ] Somente hash do segredo é persistido; busca por token puro não é possível.
- [ ] Desafio só é consumido uma vez, inclusive sob confirmações concorrentes.
- [ ] Metadata é persistida como JSON sem tipo Prisma fora da infraestrutura.
- [ ] Migrations são preparadas em código e não aplicadas.
- [ ] Testes sem banco passam; PostgreSQL fica pendente de `DATABASE_URL`.

**Tests:** unit
**Gate:** full
**Commit:** `feat(auth): persist password reset requests`

### T9: [AUTH-09] Integrar o Resend

**Status:** Bloqueada por autorização de instalação e configuração externa
**What:** Implementar `EmailProvider` com SDK oficial Resend, leitura segura de
configuração e logs sanitizados.
**Where:** adapter de e-mail de `auth`, com client simulado.
**Depends on:** T1.
**Requirement:** AUTH-RF-007, AUTH-RF-009.

**Done when:**

- [ ] SDK só é instalado após autorização explícita.
- [ ] Adapter envia recuperação e aviso de alteração.
- [ ] Falhas não vazam token, link, destinatário ou conteúdo nos logs.
- [ ] Testes cobrem sucesso e falha com client simulado.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): add resend email provider`

### T10: [AUTH-10] Implementar solicitação de recuperação

**Status:** Bloqueada pelas políticas de recuperação
**What:** Gerar desafio seguro, registrar auditoria, enviar link e sempre
responder de forma neutra.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T8, T9 e contrato USR-09.
**Requirement:** AUTH-RF-007, AUTH-RF-011.

**Done when:**

- [ ] E-mail existente, ausente ou inativo resulta na mesma resposta 202.
- [ ] Token é criptograficamente seguro e somente seu hash é persistido.
- [ ] Metadata é apenas auditoria; falha de envio não muda a resposta.
- [ ] Proteção contra abuso e política de reprocessamento são aprovadas antes
      de disponibilizar o endpoint.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): request password reset`

### T11: [AUTH-11] Implementar confirmação da recuperação

**Status:** Bloqueada pelas políticas de recuperação
**What:** Validar desafio e senha e atualizar atomicamente senha, solicitação,
desafio e sessões.
**Where:** caso de uso, unidade de trabalho e testes de `auth`.
**Depends on:** T8, T9, T10, T2 e contrato USR-09.
**Requirement:** AUTH-RF-008, AUTH-RF-009, AUTH-RF-011.

**Done when:**

- [ ] Senha e confirmação obedecem a política aprovada.
- [ ] Token inválido, expirado ou reutilizado não altera a senha.
- [ ] Troca de hash, consumo, conclusão e revogação ocorrem na mesma transação.
- [ ] Nenhuma sessão nova é criada; falha de notificação não desfaz a troca.

**Tests:** unit e integration
**Gate:** full
**Commit:** `feat(auth): confirm password reset`

### T12: [AUTH-12A] Compor rotas centrais de autenticação

**Status:** Bloqueada por cookie, CSRF e regra de username com `@`
**What:** Compor rotas de cadastro, login, refresh, logout e contexto de sessão,
com cookies `SameSite=None; Secure` e defesa CSRF aprovada.
**Where:** apresentação e composition root de `auth`, com testes HTTP.
**Depends on:** T4, T5, T6, T7.
**Requirement:** AUTH-RF-001 a AUTH-RF-006.

**Done when:**

- [ ] Rotas centrais seguem contratos HTTP existentes e não retornam tokens.
- [ ] Cookies HttpOnly usam configuração segura e atributos idênticos ao limpar.
- [ ] `Origin` e mecanismo CSRF são validados nas requisições mutáveis.
- [ ] `/auth/register` delega cadastro ao caso de uso público de `users`.
- [ ] `/auth/me` retorna somente `userId` e `sessionId`.
- [ ] Testes HTTP cobrem fluxos, atributos de cookies e CSRF.

**Tests:** e2e
**Gate:** full
**Commit:** `feat(auth): expose core authentication routes`

### T13: [AUTH-12B] Compor rotas de recuperação

**Status:** Bloqueada por T8–T11 e políticas de recuperação
**What:** Expor endpoints de solicitar e confirmar reset sem alterar contratos
HTTP compartilhados fora da proposta aprovada.
**Where:** controllers, schemas, rotas e composition root de `auth`.
**Depends on:** T8, T9, T10, T11, T12.
**Requirement:** AUTH-RF-007 a AUTH-RF-011.

**Done when:**

- [ ] Rotas respondem conforme os status neutros definidos na feature.
- [ ] Respostas não permitem enumeração de e-mail.
- [ ] Tokens, senhas, cookies e conteúdo do e-mail não aparecem em logs.
- [ ] Testes HTTP cobrem recuperação e erros documentados.

**Tests:** e2e
**Gate:** full
**Commit:** `feat(auth): expose password reset routes`

### T14: [AUTH-13] Integrar redirecionamento de recuperação no frontend

**Status:** A fazer após T11 e telas de recuperação
**What:** Redirecionar para login após confirmação válida, sem criar sessão.
**Where:** telas e serviços do frontend de autenticação, com testes.
**Depends on:** T11.
**Requirement:** AUTH-RF-010.

**Done when:**

- [ ] Sucesso 204 redireciona à tela de login.
- [ ] Erros são exibidos em português sem expor o token.
- [ ] Nenhum cookie de autenticação é criado pelo fluxo de reset.

**Tests:** unit e e2e
**Gate:** full
**Commit:** `feat(auth): redirect password reset to login`

### T15: [AUTH-14] Reconciliar documentação

**Status:** A fazer após implementação e validação
**What:** Atualizar documentação geral e rotas conforme comportamento validado.
**Where:** documentação geral e referências de auth afetadas.
**Depends on:** T12, T13, T14.
**Requirement:** AUTH-RF-001 a AUTH-RF-011.

**Done when:**

- [ ] Documentação descreve apenas fluxos implementados e verificados.
- [ ] Refresh sem rotação e configuração sem segredos estão documentados.
- [ ] Links, exemplos e divergências foram revisados.

**Tests:** none
**Gate:** build
**Commit:** `docs(auth): document authentication flows`

### T16: [AUTH-15] Expirar solicitações e desafios pendentes

**Status:** Backlog, depende de agendamento aprovado
**What:** Processar solicitações e desafios pendentes vencidos em lotes e de
forma idempotente.
**Where:** processo interno e testes de `auth`.
**Depends on:** T8 e mecanismo de agendamento aprovado.
**Requirement:** AUTH-RF-007, AUTH-RF-008.

**Done when:**

- [ ] Solicitações vencidas recebem `EXPIRED`; registros não processáveis,
      `FAILED`; desafios vencidos, `EXPIRED`.
- [ ] O processo não envia e-mail, troca senha ou cria sessão.
- [ ] Testes cobrem expiração, idempotência, paginação e concorrência.

**Tests:** unit e integration
**Gate:** full
**Commit:** `feat(auth): expire pending authentication challenges`

## Test Coverage Matrix

> Proveniência: `AGENTS.md`, testes existentes e `backend/package.json`. Não há
> scripts `test`, `lint` ou `typecheck` configurados.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domínio, casos de uso e providers | unit | Requisitos e casos de borda de cada tarefa | `backend/test/auth/*.test.ts` | `node --import tsx --test test/auth/*.test.ts` |
| Repositories Prisma | unit; integração PostgreSQL adiada | Mapeamento e comportamento sem banco; integração após DATABASE_URL | `backend/test/auth/*.test.ts` | `node --import tsx --test test/auth/*.test.ts` |
| Rotas e middleware HTTP | e2e | Caminho feliz, erros, cookies, CSRF e autorização | `backend/test/auth/*.test.ts` | `node --import tsx --test test/auth/*.test.ts` |
| Frontend | unit e e2e | Sucesso, token inválido e ausência de sessão | testes do frontend | scripts existentes a confirmar |

## Gate Check Commands

> Executar dentro do pacote correspondente; confirmar scripts disponíveis.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefas unitárias de backend | `node --import tsx --test test/auth/*.test.ts` |
| Full | Persistência, HTTP ou frontend | Testes do pacote afetado e `node node_modules/typescript/bin/tsc --noEmit` no backend |
| Build | Fechamento de fase ou tarefa sem testes | `node node_modules/typescript/bin/tsc --noEmit` no backend; scripts de build/lint do frontend a confirmar |

Testes de integração PostgreSQL ficam adiados até a configuração de
`DATABASE_URL`. Não executar migrations nesta implementação.

## Pending Decisions and Blockers

- Definir se username pode conter `@`; isso afeta resolução inequívoca de
  `identifier` em login.
- Definir nomes de cookies, `Path` e origens permitidas.
- Escolher implementação concreta de CSRF para `SameSite=None; Secure`.
- Definir duração e política da senha no reset; até lá, T8–T11 e T13 ficam
  bloqueadas conforme decisão do usuário.
- Autorizar instalação do SDK `resend` antes de T9.
- Configurar `RESEND_FROM_EMAIL` e `FRONTEND_URL` para validar envio real.
- Definir limite contra abuso, política de retry de e-mail e retenção de
  metadata antes de disponibilizar reset.
- Configurar `DATABASE_URL` para validar migrations e integração PostgreSQL.
- T16 permanece em backlog até aprovação do mecanismo de agendamento.
