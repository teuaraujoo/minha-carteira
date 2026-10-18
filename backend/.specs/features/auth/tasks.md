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

T4–T7 consomem o contrato público de `users` implementado em USR-09. A
identificação usa `@` para classificar e-mail; usernames rejeitam esse caractere.
T12 usa cookies definidos e double-submit cookie combinado com validação de
`Origin`, conforme `design.md`.

### Fase 3 — Recuperação de senha

```text
T1 → T8 → T10 → T11
T1 → T9 → T10
T9 → T11
T8 → T11
T2 → T11
```

As políticas de recuperação estão aprovadas. T8 pode iniciar; T9 depende da
autorização para instalar o SDK Resend e da configuração externa. T10 e T11
seguem após as dependências indicadas.

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

**Status:** Concluída; validação PostgreSQL pendente
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
- [x] Migration é preparada/revisada em código, mas não aplicada.
- [x] Testes sem banco passam; teste PostgreSQL fica registrado como pendente.

Integração PostgreSQL permanece pendente até a configuração de `DATABASE_URL`;
a migration foi preparada em código e não foi aplicada.

**Tests:** unit
**Gate:** full
**Commit:** `feat(auth): persist user sessions`

### T4: [AUTH-04] Implementar caso de uso de login

**Status:** Concluída
**What:** Validar credenciais e criar sessão usando `UsersAuthGateway`.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T2, T3 e contrato USR-09.
**Requirement:** AUTH-RF-001, AUTH-RF-002.

**Done when:**

- [x] Entrada preserva a senha sem `trim` e normaliza somente o identificador.
- [x] E-mail e username encontram credenciais pelo contrato público de `users`.
- [x] Identificador com `@` é tratado como e-mail; sem `@`, como username.
- [x] Usuário ausente, senha incorreta e usuário inativo geram o mesmo erro
      público.
- [x] Sessão guarda hash do refresh token e saída pública não contém tokens ou hash.
- [x] Testes cobrem sucesso e erros indistinguíveis.

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

**Status:** Concluída
**What:** Revogar a sessão atual de forma idempotente e remover cookies.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T3, T6.
**Requirement:** AUTH-RF-004.

**Done when:**

- [x] Sessão ativa recebe motivo `LOGOUT` e data de revogação.
- [x] Sessão inválida ou já revogada continua permitindo limpeza dos cookies.
- [x] Resposta é 204, cookies são limpos e refresh posterior é rejeitado.

O caso de uso não controla cookies; essa responsabilidade pertence à rota HTTP.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): implement session logout`

### T8: [AUTH-08] Implementar persistência da recuperação

**Status:** Implementada; teste PostgreSQL pendente de configuração do banco
**What:** Implementar repositories de solicitações e desafios, metadata tipada
e consumo atômico do desafio.
**Where:** infraestrutura de `auth`, com testes sem banco.
**Depends on:** T1.
**Requirement:** AUTH-RF-007, AUTH-RF-008, AUTH-RF-009, AUTH-RF-011.

**Done when:**

- [x] Somente hash do segredo é persistido; busca por token puro não é possível.
- [x] O token identifica o desafio com `challengeId.secret`; somente `secret`
      é comparado com o hash persistido.
- [x] Desafios de reset expiram em 15 minutos e permitem três tentativas
      inválidas; a terceira falha marca o desafio como `FAILED`.
- [x] Desafio só é consumido uma vez por atualização condicional; teste de uso
      concorrente cobre uma única confirmação bem-sucedida.
- [x] Metadata é persistida como JSON sem tipo Prisma fora da infraestrutura.
- [x] A exclusão de uma solicitação também remove seus desafios polimórficos
      na mesma transação.
- [x] Migrations são preparadas em código e não aplicadas.
- [x] Testes sem banco passam; PostgreSQL fica pendente de `DATABASE_URL`.

**Tests:** unit
**Gate:** full
**Commit:** `feat(auth): persist password reset requests`

### T9: [AUTH-09] Integrar o Resend

**Status:** Implementada; envio real não executado
**What:** Implementar `EmailProvider` com SDK oficial Resend, leitura segura de
configuração e logs sanitizados.
**Where:** adapter de e-mail de `auth`, com client simulado.
**Depends on:** T1.
**Requirement:** AUTH-RF-007, AUTH-RF-009.

**Done when:**

- [x] SDK foi instalado após autorização explícita do usuário.
- [x] Adapter envia recuperação e aviso de alteração.
- [x] Falhas não expõem token, link ou conteúdo ao erro público; logs são
      sanitizados e não incluem destinatário, link ou conteúdo.
- [x] Testes cobrem sucesso e falha com client simulado.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): add resend email provider`

### T10: [AUTH-10] Implementar solicitação de recuperação

**Status:** Implementada; validação HTTP pendente no ambiente atual
**What:** Gerar desafio seguro, registrar auditoria, enviar link e sempre
responder de forma neutra.
**Where:** caso de uso e testes de `auth`.
**Depends on:** T8, T9 e contrato USR-09.
**Requirement:** AUTH-RF-007, AUTH-RF-011.

**Done when:**

- [x] E-mail existente, ausente ou inativo resulta na mesma resposta 202.
- [x] Token é criptograficamente seguro e somente seu hash é persistido.
- [x] Metadata é apenas auditoria; falha de envio não muda a resposta.
- [x] O limitador em memória aplica no máximo três solicitações por e-mail
      normalizado e dez por IP, em janela móvel de uma hora.
- [x] Limite excedido não envia e-mail, não bloqueia a conta e mantém a mesma
      resposta neutra 202.
- [x] Falha do Resend marca solicitação e desafio como `FAILED`, sem nova
      tentativa automática e sem alterar a resposta pública.
- [x] Testes cobrem limites, expiração das janelas e o teto de 10.000 chaves;
      o contador é por processo e reinicia junto com ele.
- [x] Ao atingir o teto, novas chaves são negadas internamente; a resposta
      pública permanece neutra e chaves existentes continuam sujeitas aos
      limites individuais.

**Tests:** unit
**Gate:** quick
**Commit:** `feat(auth): request password reset`

### T11: [AUTH-11] Implementar confirmação da recuperação

**Status:** Implementada; PostgreSQL e HTTP pendentes de validação ambiental
**What:** Validar desafio e senha e atualizar atomicamente senha, solicitação,
desafio e sessões.
**Where:** caso de uso, unidade de trabalho e testes de `auth`.
**Depends on:** T8, T9, T10, T2 e contrato USR-09.
**Requirement:** AUTH-RF-008, AUTH-RF-009, AUTH-RF-011.

**Done when:**

- [x] Senha e confirmação obedecem à mesma política do cadastro.
- [x] Token inválido, expirado ou reutilizado não altera a senha.
- [x] Token é válido por 15 minutos; a terceira validação inválida marca o
      desafio como `FAILED`.
- [x] Troca de hash, consumo, conclusão e revogação ocorrem na mesma transação.
- [x] Nenhuma sessão nova é criada; falha de notificação não desfaz a troca.

**Tests:** unit e integration
**Gate:** full
**Commit:** `feat(auth): confirm password reset`

### T12: [AUTH-12A] Compor rotas centrais de autenticação

**Status:** Implementada; execução dos testes HTTP bloqueada por EACCES no ambiente
**What:** Compor rotas de cadastro, login, refresh, logout e contexto de sessão,
com cookies `SameSite=None; Secure` e defesa CSRF aprovada.
**Where:** apresentação e composition root de `auth`, com testes HTTP.
**Depends on:** T4, T5, T6, T7.
**Requirement:** AUTH-RF-001 a AUTH-RF-006.

**Done when:**

- [x] Rotas centrais seguem contratos HTTP existentes e não retornam tokens.
- [x] Cookies HttpOnly usam configuração segura e atributos idênticos ao limpar.
- [x] Cookies usam `__Secure-mc_access`, `__Secure-mc_refresh`,
      `SameSite=None` e `Secure`.
- [x] `/auth/csrf` emite `__Secure-mc_csrf` e retorna o token para o cliente.
- [x] `Origin` na allowlist e `X-CSRF-Token` correspondente ao cookie são
      validados nas requisições mutáveis.
- [x] `/auth/register` delega cadastro ao caso de uso público de `users`.
- [x] `/auth/me` retorna somente `userId` e `sessionId`.
- [ ] Testes HTTP cobrem os fluxos, mas não puderam ser executados: o sandbox
      bloqueou conexões locais em `127.0.0.1` com `EACCES`.

**Tests:** e2e
**Gate:** full
**Commit:** `feat(auth): expose core authentication routes`

### T13: [AUTH-12B] Compor rotas de recuperação

**Status:** Implementada; testes HTTP escritos, execução bloqueada por EACCES
**What:** Expor endpoints de solicitar e confirmar reset sem alterar contratos
HTTP compartilhados fora da proposta aprovada.
**Where:** controllers, schemas, rotas e composition root de `auth`.
**Depends on:** T8, T9, T10, T11, T12.
**Requirement:** AUTH-RF-007 a AUTH-RF-011.

**Done when:**

- [x] Rotas respondem conforme os status neutros definidos na feature.
- [x] Respostas não permitem enumeração de e-mail.
- [x] Tokens, senhas, cookies e conteúdo do e-mail não aparecem em logs.
- [ ] Testes HTTP foram escritos, mas a execução local falhou porque o sandbox
      bloqueou conexões em `127.0.0.1` com `EACCES`.

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

- Configurar `FRONTEND_ORIGINS` (origens separadas por vírgula) em cada
  ambiente; `FRONTEND_URL` permanece como compatibilidade para uma única origem.
- Envio real pelo Resend permanece pendente de validação operacional, embora o
  adapter e suas configurações estejam implementados.
- Configurar e validar o endereço IP quando houver proxy confiável; não confiar
  em cabeçalhos encaminhados por clientes não confiáveis.
- Configurar `DATABASE_URL` para validar migrations e integração PostgreSQL;
  nenhuma migration foi aplicada nesta implementação.
- Validar rotas autenticadas contra PostgreSQL após configurar o banco local;
  os testes atuais usam portas locais e dependências simuladas.
- T16 permanece em backlog até aprovação do mecanismo de agendamento.
