# Tarefas — módulo de autenticação

## Ordem de execução

### AUTH-01 — Definir contratos e entidades

**Depende de:** formato de `UsersAuthGateway` aprovado; sua implementação pode
ser entregue depois por USR-09.

- criar `RefreshToken`, `PasswordResetRequest` e `Challenge` sem sufixo
  `Props`;
- implementar os cinco motivos de revogação aprovados;
- definir `RequestMetadata` sem importar tipos do Prisma;
- definir DTOs da aplicação;
- definir repositories e providers;
- tipar claims e contexto autenticado;
- manter domínio independente de bibliotecas externas.

**Testes:** entidades, expiração, revogação e uso único.

**Gate:** TypeScript sem `any` nos contratos do módulo.

**Commit sugerido:** `feat(auth): define authentication contracts`

### AUTH-02 — Implementar provider JWT

**Depende de:** AUTH-01.

- adaptar jsonwebtoken ao `JwtProvider`;
- fixar algoritmo permitido;
- separar validação de access e refresh;
- traduzir erros externos para erros da aplicação.

**Testes:** assinatura, expiração e tipo incorreto. O adapter bcrypt
compartilhado é coberto por USR-00.

**Gate:** refresh token falha na validação de access e vice-versa.

**Commit sugerido:** `feat(auth): add jwt provider`

### AUTH-03 — Implementar persistência de refresh tokens

**Depende de:** AUTH-01; mudança de schema exige aprovação.

- criar modelo e repository Prisma de refresh token;
- armazenar hash do refresh token;
- calcular `expiresAt` para cinco dias após a emissão;
- persistir `userAgent` e endereço IP como dados opcionais de auditoria;
- consultar somente refresh tokens não revogados e não expirados;
- revogar um refresh token e todos os refresh tokens de um usuário;
- expor `RefreshTokensGateway` para revogação por outros módulos;
- preparar a migration `create-refresh-tokens` sem executá-la em produção.

**Testes:** integração de criação, consulta, expiração e revogação.

**Gate:** token cujo hash não corresponde à sessão é rejeitado.

**Commit sugerido:** `feat(auth): persist user sessions`

### AUTH-04 — Implementar login

**Depende de:** AUTH-02, AUTH-03, USR-00 e implementação de
`UsersAuthGateway` em USR-09.

- validar `identifier` e `password`;
- buscar por e-mail ou nome de usuário;
- usar o mesmo status, código e mensagem para usuário ausente, senha incorreta e
  usuário inativo;
- criar sessão e definir cookies;
- não retornar tokens no corpo.

**Testes:** e-mail, username, senha inválida, usuário ausente e inativo.

**Gate:** cookies e envelope HTTP correspondem à especificação.

**Commit sugerido:** `feat(auth): implement user login`

### AUTH-05 — Implementar refresh sem rotação

**Depende de:** AUTH-02, AUTH-03 e implementação de `UsersAuthGateway` em
USR-09.

- ler refresh cookie;
- validar token, sessão, hash e usuário;
- emitir apenas novo access token;
- manter o refresh token atual;
- documentar o risco aceito desta fase.

**Testes:** sucesso, expirado, revogado, hash divergente e usuário inativo.

**Gate:** teste comprova que o refresh cookie não é substituído.

**Commit sugerido:** `feat(auth): implement session refresh`

### AUTH-06 — Implementar middleware autenticado

**Depende de:** AUTH-02, AUTH-03 e implementação de `UsersAuthGateway` em
USR-09.

- tipar extensão de `Express.Request`;
- validar access cookie, sessão e usuário;
- atribuir `request.auth.userId` e `sessionId`;
- produzir erros em português;
- integrar às rotas privadas.

**Testes:** ausente, inválido, expirado, tipo incorreto, revogado e sucesso.

**Gate:** uma rota de teste recebe o ID correto somente com sessão válida.

**Commit sugerido:** `feat(auth): add authentication middleware`

### AUTH-07 — Implementar logout

**Depende de:** AUTH-03 e AUTH-06.

- revogar a sessão atual;
- limpar cookies com atributos compatíveis;
- sempre limpar cookies, mesmo se a sessão estiver inválida ou já revogada;
- tratar a revogação como melhor esforço para manter idempotência;
- responder 204.

**Testes:** sessão ativa, já revogada e cookies removidos.

**Gate:** refresh posterior ao logout é rejeitado.

**Commit sugerido:** `feat(auth): implement session logout`

### AUTH-08 — Implementar persistência de recuperação

**Depende de:** AUTH-01; mudança de schema exige aprovação.

- criar modelos e repositories Prisma para solicitação e desafio;
- persistir o hash do segredo somente em `Challenge`;
- vincular o desafio à solicitação por `subjectType` e `subjectId`;
- persistir metadata tipada nas duas entidades como JSON na infraestrutura;
- iniciar `Challenge.metadata.consumed` como nulo;
- consultar apenas desafio pendente e não expirado;
- consumir desafio de forma atômica contra confirmações concorrentes;
- manter múltiplas solicitações pendentes até conclusão, cancelamento ou
  processamento do job de backlog;
- preparar as migrations `create-password-reset-requests` e
  `create-challenges` sem executá-las em produção.

**Testes:** criação, uso único, concorrência, expiração e invalidação.

**Gate:** busca pelo token em texto puro não é possível no banco.

**Commit sugerido:** `feat(auth): persist password reset requests`

### AUTH-09 — Integrar o Resend

**Depende de:** AUTH-01 e aprovação para instalar o SDK `resend`.

- instalar o SDK com Yarn 4 após autorização;
- implementar `EmailProvider`;
- validar configuração na inicialização;
- criar e-mail de recuperação e notificação de alteração;
- sanitizar logs e erros do provedor.

**Testes:** adapter com client simulado, sucesso e falha do provedor.

**Gate:** nenhum teste ou log contém token, link completo ou destinatário.

**Commit sugerido:** `feat(auth): add resend email provider`

### AUTH-10 — Implementar solicitação de recuperação

**Depende de:** AUTH-08, AUTH-09 e `UsersAuthGateway`.

- validar e normalizar e-mail;
- responder de modo neutro para usuário existente ou ausente;
- gerar token criptograficamente seguro;
- persistir hash e montar link com `FRONTEND_URL`;
- registrar metadata de auditoria sem usá-la para bloquear ou autorizar o fluxo;
- enviar e-mail somente quando aplicável;
- manter a mesma resposta 202 quando o Resend falhar;
- aplicar a política aprovada de reprocessamento de entrega;
- aplicar proteção contra abuso conforme política aprovada.

**Testes:** usuário existente, ausente, inativo e falha controlada de envio.

**Gate:** resposta pública não permite enumerar e-mails.

**Commit sugerido:** `feat(auth): request password reset`

### AUTH-11 — Implementar confirmação da recuperação

**Depende de:** AUTH-08, AUTH-09, AUTH-10, USR-00 e USR-09.

- validar token, senha e confirmação;
- montar a metadata da confirmação e registrá-la no consumo do desafio;
- trocar hash da senha via contrato público de `users`;
- usar `PasswordResetUnitOfWork` para trocar o hash, consumir o desafio,
  concluir a solicitação e revogar refresh tokens na mesma transação;
- enviar notificação de alteração;
- manter 204 se a notificação falhar e encaminhá-la ao reprocessamento aprovado;
- não criar sessão nem retornar token.

**Testes:** sucesso, token inválido, expirado, usado e senhas divergentes.

**Gate:** token reutilizado falha e sessões anteriores não fazem refresh.

**Commit sugerido:** `feat(auth): confirm password reset`

### AUTH-12 — Implementar rotas e composição

**Depende de:** AUTH-04 a AUTH-11.

- criar schemas, controllers e rotas;
- manter `/auth/register` na apresentação de `auth`, delegando a criação para o
  caso de uso público de `users`;
- compor providers e repositories no `Composition Root`;
- configurar cookies e CORS por ambiente;
- implementar a estratégia CSRF e validação de `Origin` aprovadas;
- adicionar `INVALID_OR_EXPIRED_TOKEN` ao contrato HTTP ou mapear para um código
  existente;
- fazer `/auth/me` retornar apenas `userId` e `sessionId`; o perfil completo
  permanece em `/users/me`;
- preservar os contratos HTTP compartilhados.

**Testes:** testes HTTP de todos os fluxos e atributos dos cookies.

**Gate:** suíte HTTP cobre login, refresh, logout, middleware e reset.

**Commit sugerido:** `feat(auth): expose authentication routes`

### AUTH-13 — Integrar o redirecionamento no frontend

**Depende de:** AUTH-11 e telas de recuperação disponíveis.

- consumir a confirmação de redefinição;
- após resposta 204, redirecionar para a tela de login;
- não tratar a redefinição como sessão autenticada;
- exibir mensagens em português sem expor detalhes do token.

**Testes:** sucesso, token inválido e ausência de cookies de autenticação.

**Gate:** redefinição bem-sucedida termina na tela de login.

**Commit sugerido:** `feat(auth): redirect password reset to login`

### AUTH-14 — Reconciliar documentação

**Depende de:** AUTH-12, AUTH-13 e validação final.

- atualizar a documentação geral para o novo cadastro público;
- remover a afirmação de rotação de refresh nesta versão;
- documentar rotas e decisões efetivamente implementadas;
- registrar configuração do Resend sem incluir segredos.

**Testes:** revisão manual de links, exemplos e divergências.

**Gate:** documentação não contradiz comportamento validado.

**Commit sugerido:** `docs(auth): document authentication flows`

### AUTH-15 — Expirar solicitações e desafios pendentes

**Status:** backlog.

**Depende de:** AUTH-08 e mecanismo de agendamento aprovado.

- buscar registros pendentes com `expiresAt` vencido;
- marcar solicitações como `EXPIRED`;
- marcar solicitações ou desafios não processáveis como `FAILED`;
- marcar desafios vencidos como `EXPIRED`;
- processar em lotes e de forma idempotente;
- não enviar e-mail, trocar senha ou criar sessão;
- aplicar a política de retenção da metadata.

**Testes:** limite de expiração, idempotência, paginação e concorrência.

**Gate:** nenhum registro ainda válido é encerrado.

**Commit sugerido:** `feat(auth): expire pending authentication challenges`

## Matriz de cobertura

| Requisito | Tarefas | Evidência esperada |
| --- | --- | --- |
| AUTH-RF-001 | AUTH-04 | e-mail, username e erros indistinguíveis |
| AUTH-RF-002, AUTH-RF-003 | AUTH-03 a AUTH-05 | integração e HTTP |
| AUTH-RF-004 | AUTH-07 | logout repetido e refresh rejeitado |
| AUTH-RF-005, AUTH-RF-006 | AUTH-02, AUTH-06 | middleware protegido |
| AUTH-RF-007 | AUTH-08 a AUTH-10 | resposta neutra e adapter Resend |
| AUTH-RF-008, AUTH-RF-009 | AUTH-08, AUTH-11 | teste transacional |
| AUTH-RF-010 | AUTH-13 | teste de navegação frontend |
| AUTH-RF-011 | AUTH-01, AUTH-08, AUTH-10 | metadata sem decisão automática |

## Comandos de verificação

Confira os scripts reais antes da execução. No estado atual, o backend não
possui scripts `test`, `lint` ou `typecheck`. Os comandos conhecidos são:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test test/auth/**/*.test.ts
```

O padrão de arquivos deve ser ajustado ao suporte de glob do ambiente.

## Bloqueios antes das tarefas afetadas

- aprovar a duração dos desafios antes de AUTH-02 e AUTH-08;
- aprovar nomes e atributos finais dos cookies antes de AUTH-04;
- criar e revisar as migrations antes de AUTH-03 e AUTH-08;
- autorizar instalação do SDK `resend` antes de AUTH-09;
- informar remetente verificado e `FRONTEND_URL` antes de validar AUTH-09;
- aprovar limites contra abuso antes de concluir AUTH-10;
- aprovar política de reprocessamento de e-mail antes de concluir AUTH-10 e
  AUTH-11;
- aprovar estratégia CSRF e topologia de domínios antes de AUTH-12;
- aprovar política final de senha antes de concluir AUTH-11;
- definir prazo e mecanismo de retenção da metadata antes da disponibilização
  pública.
