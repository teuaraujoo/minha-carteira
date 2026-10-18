# Módulo de autenticação

## Objetivo

Implementar autenticação com login por e-mail ou nome de usuário, sessão baseada
em access e refresh tokens em cookies, logout com revogação, validação JWT,
middleware autenticado e recuperação de senha por link enviado pelo Resend.

## Resultado esperado

- login com `identifier` e `password`;
- cookies `HttpOnly` para access e refresh tokens;
- refresh sem rotação do refresh token nesta primeira versão;
- logout que revoga a sessão persistida;
- middleware que disponibiliza o ID autenticado;
- solicitação de recuperação com resposta neutra;
- link de recuperação contendo token único e opaco;
- redefinição de senha sem login automático;
- redirecionamento para login realizado pelo frontend após o sucesso.

## Escopo

### Incluído

- login por e-mail ou nome de usuário;
- emissão e validação de JWT de acesso;
- emissão e validação de refresh token;
- refresh token persistido no PostgreSQL como registro da sessão;
- refresh sem rotação;
- logout da sessão atual;
- middleware de autenticação;
- endpoint para obter o usuário autenticado;
- solicitação e confirmação de recuperação de senha;
- auditoria do contexto de solicitações de recuperação e desafios por metadata;
- envio transacional pelo Resend;
- revogação de todas as sessões após redefinir a senha;
- testes de segurança e integração.

### Fora do escopo

- rotação de refresh token;
- código numérico de recuperação;
- login automático após redefinir a senha;
- login social, MFA ou passkeys;
- confirmação de e-mail;
- Redis, lista distribuída de bloqueio ou rate limiting avançado;
- gerenciamento de usuários e capabilities;
- templates avançados e internacionalização de e-mails;
- análise de risco, bloqueio ou autorização automática com base na metadata;
- alertas de localização ou dispositivo desconhecido.

## Dependência do módulo `users`

`auth` consome somente `UsersAuthGateway` para localizar credenciais, validar o
estado do usuário e trocar o hash da senha. Ele não pode importar
`IUsersRepository` nem a implementação Prisma de `users`.

## Requisitos funcionais

### AUTH-RF-001 — Login

O sistema DEVE aceitar `identifier` e `password`. `identifier` pode conter o
e-mail ou o nome de usuário. Credenciais inválidas devem produzir uma mensagem
genérica em português. Usuário ausente, senha incorreta e usuário inativo devem
ter o mesmo status, código e mensagem públicos.

### AUTH-RF-002 — Sessão

O sistema DEVE criar uma sessão persistida e enviar access e refresh tokens em
cookies seguros. O registro persistido é a entidade `RefreshToken` e contém
somente o hash da credencial. Tokens não devem ser retornados no JSON.

### AUTH-RF-003 — Refresh sem rotação

O sistema DEVE renovar o access token quando receber um refresh token válido e
uma sessão ativa. Nesta versão, o refresh token permanece o mesmo até expirar ou
a sessão ser revogada.

### AUTH-RF-004 — Logout

O sistema DEVE revogar a sessão atual e remover os dois cookies, mesmo quando a
resposta não possui corpo.

### AUTH-RF-005 — Validação JWT

O sistema DEVE validar assinatura, expiração, tipo do token, sessão e estado do
usuário. Um refresh token não pode autenticar uma rota protegida como access
token.

### AUTH-RF-006 — Contexto autenticado

O middleware DEVE disponibilizar `request.auth.userId` e
`request.auth.sessionId` às próximas camadas após validação completa.

`GET /auth/me` DEVE validar a sessão e retornar somente o contexto mínimo de
autenticação. O perfil completo pertence a `GET /users/me`.

### AUTH-RF-007 — Solicitação de recuperação

O sistema DEVE aceitar um e-mail e responder de forma neutra, exista ou não um
usuário correspondente. Quando aplicável, deve gerar um token aleatório, salvar
somente seu hash em um `Challenge` vinculado à `PasswordResetRequest` e enviar
um link pelo Resend. Falhas de entrega também não podem alterar a resposta
pública neutra. O servidor limita solicitações por e-mail normalizado e por IP,
independentemente de a conta existir. Ao exceder o limite, mantém a resposta
neutra e não envia outro e-mail.

### AUTH-RF-008 — Confirmação da recuperação

O sistema DEVE aceitar `token`, `password` e `passwordConfirmation`. Deve
validar igualdade, política de senha, expiração, uso único e vínculo do token
antes de trocar o hash. A validação usa o `Challenge` e resolve sua
`PasswordResetRequest` associada. O token identifica o desafio e contém um
segredo; cada segredo inválido incrementa `attempts`. Após três falhas, o
desafio recebe status `FAILED`.

### AUTH-RF-009 — Pós-recuperação

O sistema DEVE consumir o desafio, concluir a solicitação, revogar todos os
refresh tokens do usuário e enviar uma notificação de alteração. Não deve criar
uma nova sessão.

### AUTH-RF-010 — Redirecionamento

Após a API confirmar a redefinição, o frontend DEVE redirecionar a pessoa para a
tela de login. A API não precisa responder com redirecionamento HTTP.

### AUTH-RF-011 — Metadata de auditoria

O sistema DEVE registrar `metadata` em `PasswordResetRequest` e `Challenge` para
auditoria. A estrutura pode conter localização informada pelo frontend,
`userAgent`, endereço IP e `deviceId`. Nesta versão, esses dados NÃO DEVEM
aprovar, rejeitar ou alterar o resultado de login, recuperação ou desafio.

Endereço IP deve ser obtido da conexão ou de proxies confiáveis, e `userAgent`
deve ser obtido pela camada HTTP. Localização e `deviceId` são declarados pelo
cliente. Nenhum desses valores é evidência confiável de identidade.

`PasswordResetRequest.metadata` registra o início do processo. A metadata de
`Challenge` separa o contexto de emissão do contexto de consumo, permitindo
comparação futura sem interferir no comportamento atual.

## Critérios de aceitação

- [x] Login funciona com e-mail ou nome de usuário no mesmo campo.
- [x] Respostas de erro não revelam se o identificador existe.
- [x] Usuário ausente, senha incorreta e usuário inativo são indistinguíveis no
  login.
- [x] Access e refresh tokens ficam somente em cookies `HttpOnly`.
- [x] Refresh válido emite novo access token sem trocar o refresh token.
- [x] Logout revoga a sessão e limpa os cookies.
- [x] Middleware adiciona `request.auth.userId` após validação completa.
- [x] Token de refresh não é aceito como token de acesso.
- [x] Rotas mutáveis de auth exigem `Origin` permitido e token double-submit
  válido em cookie e `X-CSRF-Token`.
- [x] Cadastro não inicia sessão automaticamente.
- [x] Logout usa access ou refresh válido para localizar a sessão e sempre limpa
  cookies, mesmo sem credenciais válidas.
- [ ] Solicitação de reset produz resposta indistinguível para e-mail ausente.
- [ ] Falha do Resend marca a solicitação e o desafio como `FAILED`, sem mudar
  status, código ou mensagem da resposta pública.
- [ ] O e-mail do Resend contém link com token, sem código numérico.
- [ ] O token usa `challengeId.secret`, expira em 15 minutos e só seu segredo
  é persistido como hash.
- [ ] A terceira validação inválida marca o desafio como `FAILED`.
- [ ] A senha redefinida segue a mesma política do cadastro.
- [ ] O limitador aplica três solicitações por e-mail normalizado e dez por IP
  em janela móvel de uma hora, em memória no processo.
- [ ] Exceder o limite mantém a resposta neutra 202 e não envia e-mail.
- [ ] Solicitação e desafio persistem metadata de auditoria sem alterar o
  resultado do fluxo.
- [ ] A aplicação não trata localização, IP, `userAgent` ou `deviceId` como
  mecanismo de autenticação nesta versão.
- [ ] Token expirado, usado ou inválido não altera a senha.
- [ ] Redefinição válida revoga todas as sessões e não autentica
  automaticamente.
- [ ] Token, senha, cookies e conteúdo do e-mail não aparecem em logs.
- [ ] Metadata permanece enquanto existir seu registro e é removida com ele;
  desafios polimórficos vinculados são excluídos na mesma transação.
- [x] `auth` não acessa diretamente o repository de `users`.

## Dependências

- contrato público `UsersAuthGateway`;
- `PasswordHasher`;
- provider JWT;
- `RefreshTokenRepository`;
- `PasswordResetRequestRepository` e `ChallengeRepository`;
- `TokenGenerator`, `TokenHasher` e `ClockProvider`;
- `EmailProvider` implementado com o SDK do Resend;
- configuração segura de cookies e CORS;
- proteção contra CSRF definida para a topologia aprovada;
- frontend com páginas de solicitação e redefinição.

## Decisões confirmadas

- login aceita e-mail ou nome de usuário;
- username não pode conter `@`; o login classifica o identificador com `@`
  como e-mail e os demais como username;
- sessão usa access e refresh tokens;
- tokens são enviados por cookies;
- cookies usam `SameSite=None; Secure` e a proteção CSRF deve ser explícita;
- cookies de autenticação usam `__Secure-mc_access` e `__Secure-mc_refresh`;
- operações mutáveis usam double-submit cookie para CSRF e validam `Origin`
  exato na allowlist;
- access e CSRF usam cookie com `Path=/api/v1`; refresh usa
  `Path=/api/v1/auth`;
- origens permitidas são configuradas por `FRONTEND_ORIGINS` (ou, para uma
  origem, `FRONTEND_URL`);
- refresh token não é rotacionado nesta versão;
- access token expira em 15 minutos;
- refresh token expira em cinco dias;
- o refresh token é persistido somente como hash;
- os motivos de revogação são `LOGOUT`, `PASSWORD_RESET`,
  `USER_DEACTIVATED`, `ADMINISTRATIVE_ACTION` e `SECURITY_EVENT`;
- recuperação usa `PasswordResetRequest` vinculada a um `Challenge` genérico;
- o token de reset contém `challengeId.secret`; somente o hash do segredo é
  persistido;
- o token de reset expira 15 minutos após a emissão e permite três tentativas
  inválidas por desafio;
- a senha redefinida segue a mesma política do cadastro, que atualmente exige
  no mínimo oito caracteres e não aplica `trim`;
- solicitações de reset têm limite móvel de três por e-mail normalizado e dez
  por IP, por hora, em memória no processo do servidor;
- o limitador mantém no máximo 10.000 chaves ativas. Ao atingir o teto, nega
  novas chaves internamente até expirarem entradas; a resposta continua neutra
  e chaves já existentes continuam sujeitas aos limites por e-mail e IP;
- o limitador é por processo, perde seus contadores após reinício e pressupõe
  uma única instância da aplicação nesta versão;
- exceder o limite não revela a existência da conta, não envia e-mail e não
  bloqueia o usuário;
- falha ao enviar o link marca a solicitação e o desafio como `FAILED`; o
  sistema não reprocessa automaticamente e mantém a resposta pública neutra;
- `PasswordResetRequest` e `Challenge` guardam metadata para auditoria;
- metadata não participa de decisões de segurança nesta versão;
- metadata permanece enquanto existir o registro que a contém e é removida
  junto com ele, sem prazo separado;
- logout revoga a sessão;
- recuperação é usada por pessoa deslogada;
- recuperação usa somente token no link enviado por e-mail;
- envio de e-mail utiliza Resend;
- após redefinir, o frontend redireciona para login;
- não há login automático após redefinição;
- a expiração de solicitações e desafios pendentes por processo agendado fica
  no backlog;
- solicitações e desafios podem terminar como `FAILED`;
- relações obrigatórias com o usuário usam exclusão em cascata.

## Decisões pendentes

- domínio e remetente verificados no Resend;
- URL pública do frontend usada no link;
- configuração segura de proxy/origem do IP caso a aplicação seja executada
  atrás de um proxy confiável;

## Backlog de segurança contextual

Uma evolução posterior pode utilizar a metadata para identificar recuperação em
localização incomum, mudança de dispositivo ou repetição de tentativas. Análise
equivalente no login exigirá ampliar `RefreshToken` ou criar uma entidade de
auditoria. Essa evolução exige política de risco, tolerância a falsos positivos,
retenção de dados, privacidade e comunicação ao usuário. Até essa análise ser
aprovada, a metadata serve apenas para auditoria e investigação manual.

Também permanece no backlog um processo agendado para encerrar registros
pendentes. O processo deve marcar solicitações vencidas como `EXPIRED` e
desafios vencidos ou não processáveis como `EXPIRED` ou `FAILED`. O sistema não
executa essa rotina durante o fluxo HTTP.

`PasswordResetRequestStatus` e `ChallengeStatus` possuem `FAILED` para falhas de
processamento. `CANCELLED` permanece reservado para encerramento intencional de
uma solicitação ainda válida.

## Referências de segurança

- [OWASP Forgot Password Cheat
  Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [Resend — Send emails with
  Node.js](https://resend.com/docs/send-with-nodejs)
- [Resend — Send Email API](https://resend.com/docs/api-reference/emails/send-email)

Essas referências orientam geração segura, resposta neutra, uso único e envio.
Os valores de tempo e limites continuam sujeitos à decisão do projeto.
