# Design técnico — módulo de autenticação

## Organização Onion Architecture

```text
auth/
├── domain/
│   ├── entities/
│   ├── errors/
│   └── repositories/
├── application/
│   ├── contracts/
│   ├── dto/
│   └── use-cases/
├── infrastructure/
│   ├── email/
│   ├── repositories/
│   └── security/
└── presentation/
    ├── controllers/
    ├── middleware/
    ├── routes/
    └── schemas/
```

Express, cookies, JWT, bcrypt, Prisma e Resend ficam nas bordas. Os casos de uso
dependem apenas de contratos injetados pelo `Composition Root`.

## Metadata de auditoria

```typescript
interface RequestMetadata {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  userAgent: string | null;
  ipAddress: string | null;
  deviceId: string | null;
}

interface ChallengeMetadata {
  issued: RequestMetadata;
  consumed: RequestMetadata | null;
}
```

O domínio usa `RequestMetadata`; ele não usa o tipo `Json` do Prisma. O adapter
de persistência converte essa estrutura para uma coluna JSON. A localização e o
`deviceId` são informações declaradas pelo cliente. A camada HTTP obtém
`userAgent` dos cabeçalhos e endereço IP da conexão ou de proxies explicitamente
confiáveis. Esses dados continuam sendo sinais de auditoria, não provas de
identidade.

`PasswordResetRequest.metadata` registra o contexto que iniciou a solicitação.
`Challenge.metadata.issued` registra o contexto de emissão do desafio, enquanto
`Challenge.metadata.consumed` começa nulo e recebe o contexto da requisição que
o consumiu. Essa separação permite uma comparação futura sem usá-la agora para
permitir ou negar a operação.

Nesta versão, a metadata serve apenas para auditoria. Ela não altera respostas,
não bloqueia solicitações e não comprova identidade. Detecção de localização ou
dispositivo incomum permanece no backlog.

## Modelo de refresh token

```typescript
interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  userAgent: string | null;
  ipAddress: string | null;
  revokeReason: RefreshTokenRevokeReason | null;
  createdAt: Date;
  updatedAt: Date;
}
```

Persistir o hash do refresh token reduz o impacto de leitura indevida do banco.
A ausência de rotação significa que o mesmo refresh token continua válido até
expirar após cinco dias ou até o registro ser revogado. A duração é representada
por `expiresAt`; não é necessário persistir um campo separado de duração.

Os valores confirmados para `RefreshTokenRevokeReason` são:

```typescript
enum RefreshTokenRevokeReason {
  LOGOUT = "LOGOUT",
  PASSWORD_RESET = "PASSWORD_RESET",
  USER_DEACTIVATED = "USER_DEACTIVATED",
  ADMINISTRATIVE_ACTION = "ADMINISTRATIVE_ACTION",
  SECURITY_EVENT = "SECURITY_EVENT",
}
```

`EXPIRED` não aparece como motivo de revogação porque expiração e revogação são
estados diferentes. Um token vencido pode ter `revokedAt` e `revokeReason`
nulos.

## Modelo de recuperação

```typescript
interface PasswordResetRequest {
  id: string;
  userId: string;
  status: PasswordResetRequestStatus;
  requestedAt: Date;
  expiresAt: Date;
  metadata: RequestMetadata;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

enum PasswordResetRequestStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}
```

`PasswordResetRequest` representa o processo de recuperação. O segredo enviado
no link pertence a um `Challenge` vinculado à solicitação.

## Modelo de desafio

```typescript
interface Challenge {
  id: string;
  purpose: ChallengePurpose;
  subjectType: ChallengeSubjectType;
  subjectId: string;
  secretHash: string;
  status: ChallengeStatus;
  attempts: number;
  maxAttempts: number;
  metadata: ChallengeMetadata;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

enum ChallengePurpose {
  PASSWORD_RESET = "PASSWORD_RESET",
  EMAIL_VERIFICATION = "EMAIL_VERIFICATION",
  MESSAGING_IDENTITY_VERIFICATION = "MESSAGING_IDENTITY_VERIFICATION",
}

enum ChallengeSubjectType {
  USER = "USER",
  PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST",
  MESSAGING_IDENTITY = "MESSAGING_IDENTITY",
}

enum ChallengeStatus {
  REQUESTED = "REQUESTED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  EXPIRED = "EXPIRED",
}
```

Na recuperação de senha, `subjectType` recebe `PASSWORD_RESET_REQUEST` e
`subjectId` recebe o ID da solicitação. O token em texto puro existe apenas
durante a geração do link. Banco, logs e eventos armazenam somente
`secretHash` ou identificadores técnicos.

O link usa o formato `challengeId.secret`. O ID permite localizar o desafio;
ele não é um segredo. O servidor compara o hash da parte `secret` e atualiza
`attempts` de forma atômica quando o segredo está incorreto. Na terceira falha,
marca o desafio como `FAILED`. Para reset de senha, `expiresAt` é definido para
15 minutos após a emissão e `maxAttempts` recebe `3`. A senha nova deve seguir
as mesmas validações do cadastro.

Tokens malformados ou com ID de desafio inexistente recebem erro genérico e não
alteram um desafio. O limitador por IP também protege esse caminho.

O vínculo `subjectType + subjectId` é polimórfico e não pode ter uma foreign key
convencional para todos os destinos no PostgreSQL. O caso de uso deve validar o
alvo pelo contrato do módulo proprietário e impedir desafios órfãos. A política
de limpeza desses registros deve ser definida antes da migration.

### Limitação de solicitações de reset

O endpoint mantém janelas móveis em memória no processo do servidor:

- no máximo três solicitações por e-mail normalizado em uma hora;
- no máximo dez solicitações por IP em uma hora.

O contador usa o endereço informado mesmo quando não existe usuário associado,
para que o limite não revele a existência da conta. Ao exceder qualquer limite,
o servidor não envia e-mail, mas mantém a resposta neutra `202`. O limitador não
bloqueia a conta do usuário.

As entradas expiradas devem ser removidas e o armazenamento em memória deve
permanecer limitado. Os contadores são locais a cada processo e zeram quando o
servidor reinicia; portanto, esta configuração pressupõe uma única instância.
O IP vem da conexão ou de proxies explicitamente confiáveis, nunca de um
cabeçalho encaminhado arbitrariamente pelo cliente.

### Retenção da metadata e dos registros

A metadata é armazenada no próprio registro e permanece enquanto esse registro
existir; não há prazo de retenção separado para a metadata. Apagar o registro
remove também sua metadata. O job de expiração muda status para `EXPIRED`, mas
não apaga registros.

Como `Challenge` referencia `PasswordResetRequest` por campos polimórficos e
não possui foreign key, o repository deve apagar os desafios vinculados junto
com a solicitação, na mesma transação. Isso também deve ser respeitado quando a
exclusão do usuário remover solicitações por cascade.

## Claims dos tokens

### Access token

- `sub`: ID do usuário;
- `sid`: ID do `RefreshToken` persistido, que identifica a sessão;
- `jti`: ID único do token;
- `type`: `access`;
- `iat` e `exp`.

### Refresh token

- `sub`: ID do usuário;
- `sid`: ID do `RefreshToken` persistido;
- `jti`: ID único da credencial;
- `type`: `refresh`;
- `iat` e `exp`.

O algoritmo permitido e as chaves devem ser definidos por configuração. A
validação precisa fixar explicitamente o algoritmo esperado.

## Contratos da aplicação

```typescript
interface JwtProvider {
  signAccessToken(input: TokenSubject): Promise<string>;
  signRefreshToken(input: TokenSubject): Promise<string>;
  verifyAccessToken(token: string): Promise<VerifiedToken>;
  verifyRefreshToken(token: string): Promise<VerifiedToken>;
}

interface RefreshTokenRepository {
  save(refreshToken: RefreshToken): Promise<void>;
  findActiveById(id: string): Promise<RefreshToken | null>;
  registerUse(id: string, lastUsedAt: Date): Promise<void>;
  revoke(
    id: string,
    revokedAt: Date,
    reason: RefreshTokenRevokeReason,
  ): Promise<void>;
  revokeAllFromUser(
    userId: string,
    revokedAt: Date,
    reason: RefreshTokenRevokeReason,
  ): Promise<void>;
}

interface RefreshTokensGateway {
  revokeAllFromUser(userId: string): Promise<void>;
}

interface PasswordResetRequestRepository {
  save(request: PasswordResetRequest): Promise<void>;
  complete(id: string, completedAt: Date): Promise<void>;
  cancelPendingFromUser(userId: string, cancelledAt: Date): Promise<void>;
}

interface ChallengeRepository {
  save(challenge: Challenge): Promise<void>;
  consumeUsableBySecretHash(
    hash: string,
    purpose: ChallengePurpose,
    consumedAt: Date,
  ): Promise<Challenge | null>;
  invalidatePendingForSubject(
    subjectType: ChallengeSubjectType,
    subjectId: string,
    date: Date,
  ): Promise<void>;
}

interface EmailProvider {
  sendPasswordReset(input: PasswordResetEmail): Promise<{ messageId: string }>;
  sendPasswordChanged(input: PasswordChangedEmail): Promise<void>;
}
```

Também são necessários `PasswordHasher`, `TokenGenerator`, `TokenHasher`,
`ClockProvider`, `UnitOfWork`, `AppLogger` e `UsersAuthGateway`.

`RefreshTokensGateway` é a porta pública que permite a `users` revogar sessões
durante a desativação, sem conhecer o repository interno de `auth`.

`consumeUsableBySecretHash` deve usar atualização condicional, lock de linha ou
isolamento equivalente para que somente uma confirmação concorrente consuma o
token. Uma simples sequência de leitura e atualização não satisfaz uso único.

Para redefinição de senha, o `Composition Root` deve implementar um
`PasswordResetUnitOfWork`. A execução fornece versões transacionais de
`PasswordResetRequestRepository`, `ChallengeRepository`,
`RefreshTokenRepository` e `UsersAuthGateway`, todas ligadas à mesma transação
do PostgreSQL. Nenhum tipo do Prisma pode aparecer na assinatura da aplicação.

## DTOs

- `LoginInput { identifier, password }`;
- `LoginOutput { user }`, sem tokens no JSON;
- `RefreshSessionInput`, construído a partir do cookie;
- `AuthenticatedContext { userId, sessionId }`;
- `RequestPasswordResetInput { email }`;
- `ResetPasswordInput { token, password, passwordConfirmation }`;
- `CurrentUserOutput`, obtido do contrato público de `users`.

## Cookies

- access e refresh usam `__Secure-mc_access` e `__Secure-mc_refresh`;
- ambos devem usar `HttpOnly`, `Secure` e `SameSite=None`;
- operações mutáveis exigem `Origin` exato na allowlist e o header
  `X-CSRF-Token` idêntico ao valor do cookie `__Secure-mc_csrf`; comparar os
  valores em tempo constante. O mecanismo é double-submit cookie, sem token
  sincronizador persistido no servidor;
- `GET /api/v1/auth/csrf` gera token aleatório, define cookie
  `__Secure-mc_csrf` e retorna o token no corpo para uso no header;
- o cookie CSRF também usa `Secure` e `SameSite=None`; não deve aparecer em
  logs;
- CORS com credenciais permite somente origens configuradas e não substitui a
  validação explícita de `Origin` e CSRF;
- `Path` deve ser o menor possível, especialmente para o refresh;
- logout deve expirar ambos os cookies com os mesmos atributos usados ao
  criá-los;
- access/refresh tokens não aparecem em resposta JSON nem em logs; o token CSRF
  aparece somente no corpo da resposta de emissão e não deve aparecer em logs.

Implementação atual: access e CSRF usam `Path=/api/v1`; refresh usa
`Path=/api/v1/auth`, reduzindo o envio do refresh token às rotas de autenticação.
O cookie CSRF é de sessão do navegador, sem `Max-Age`; o token aleatório é
retornado em `GET /api/v1/auth/csrf`, armazenado no cookie HttpOnly e enviado
novamente pelo frontend em `X-CSRF-Token`. Essa comparação cookie/header é o
padrão double-submit; a defesa também exige `Origin` exato na allowlist. O
backend compara header e cookie em tempo constante. A allowlist é lida de
`FRONTEND_ORIGINS`, com origens separadas
por vírgula; `FRONTEND_URL` é aceita como fallback de origem única. Sem origem
configurada, operações CSRF são negadas. O reset de senha é composto no
Composition Root e depende de `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e
`FRONTEND_URL`; nenhuma dessas configurações deve ser registrada em logs. O
access token expira em 15 minutos e o refresh token em cinco dias.

## Fluxos

### Fluxo — login

1. **Input:** recebe `identifier` e `password`.
2. **Validação:** Zod valida tipos e campos extras; a senha não é normalizada.
3. **Use case:** `UsersAuthGateway` busca credenciais pelo identificador
   normalizado e confirma usuário ativo sem variar a resposta pública.
4. **Módulos:** `PasswordHasher` compara o hash; o provider JWT cria tokens.
5. **Persistência:** salva `RefreshToken` com o hash da credencial e os dados de
   auditoria explícitos previstos pela entidade.
6. **Resposta:** controller define cookies e retorna somente a visão do usuário.

### Fluxo — refresh

1. **Input:** lê o refresh token exclusivamente do cookie.
2. **Validação:** provider confere assinatura, expiração e `type=refresh`.
3. **Use case:** consulta `RefreshToken` ativo e compara o hash da credencial.
4. **Módulos:** valida que o usuário continua ativo.
5. **Persistência:** atualiza `lastUsedAt` e não troca o refresh token nesta
   versão.
6. **Resposta:** emite novo access token no cookie e responde 204.

### Fluxo — middleware de autenticação

1. **Input:** lê o access token do cookie.
2. **Validação:** confere assinatura, expiração, `type=access` e claims.
3. **Use case:** valida sessão e usuário ativos.
4. **Módulos:** consome `RefreshTokenRepository` e `UsersAuthGateway`.
5. **Persistência:** somente leitura.
6. **Resposta:** define `request.auth = { userId, sessionId }` e chama `next`.

### Fluxo — logout

1. **Input:** obtém a sessão do contexto autenticado ou do refresh válido.
2. **Validação:** trata logout repetido de forma idempotente.
3. **Use case:** revoga a sessão atual.
4. **Módulos:** usa `ClockProvider`.
5. **Persistência:** preenche `revokedAt` e `revokeReason`.
6. **Resposta:** sempre remove os cookies e responde 204. A revogação é feita em
   melhor esforço quando a credencial já está inválida ou revogada.

### Fluxo — solicitar recuperação de senha

1. **Input:** recebe `email`.
2. **Validação:** Zod normaliza o endereço e valida a metadata aceita; a camada
   HTTP confirma IP e `userAgent`; aplica os limites por endereço e IP antes de
   consultar a conta. A resposta pública é sempre neutra.
3. **Use case:** localiza o usuário elegível por contrato público.
4. **Módulos:** gera token criptograficamente seguro, calcula hash e monta URL
   com a origem do frontend configurada.
5. **Persistência:** salva `PasswordResetRequest` e `Challenge` vinculados,
   persiste metadata para auditoria e guarda somente o hash do segredo no
   desafio.
6. **E-mail:** solicita o envio ao `EmailProvider`. Se o envio falhar, marca a
   solicitação e o desafio como `FAILED`; não tenta reenviar automaticamente.
7. **Resposta:** devolve sempre a mesma resposta neutra 202, inclusive para
   e-mail inexistente, limite excedido ou falha do Resend.

### Fluxo — redefinir senha

1. **Input:** recebe `challengeId.secret`, nova senha e confirmação.
2. **Validação:** confere igualdade e aplica a mesma política de senha do
   cadastro; a camada HTTP monta a metadata da requisição de consumo.
3. **Use case:** localiza o desafio pelo ID, compara o hash do segredo e resolve
   a solicitação vinculada. Segredo inválido incrementa `attempts`; a terceira
   falha marca o desafio como `FAILED`. O desafio expira após 15 minutos.
4. **Módulos:** gera novo hash de senha pelo `PasswordHasher` e chama
   `UsersAuthGateway`.
5. **Persistência:** `PasswordResetUnitOfWork` registra
   `Challenge.metadata.consumed`, consome o desafio, conclui a solicitação,
   troca o hash da senha e revoga todos os refresh tokens na mesma transação
   PostgreSQL.
6. **Resposta:** responde 204 e solicita a notificação de senha alterada. Falha
   nessa notificação é registrada em log sanitizado, não desfaz a troca e não
   gera reenvio automático. O frontend redireciona para login.

## Adapter do Resend

O adapter usa o SDK oficial `resend` e lê a chave de `RESEND_API_KEY`. O
remetente deve usar domínio verificado no Resend. A URL do link deve ser formada
a partir de configuração confiável, nunca do cabeçalho `Host` da requisição.

Configurações esperadas:

```text
RESEND_API_KEY
RESEND_FROM_EMAIL
FRONTEND_URL
```

O adapter deve enviar `from`, `to`, `subject` e conteúdo HTML ou texto. O ID da
mensagem pode ser registrado para diagnóstico, mas destinatário, token, link e
conteúdo integral não devem aparecer em logs.

## Rotas

| Método | Rota | Auth | Resultado |
| --- | --- | --- | --- |
| POST | `/api/v1/auth/register` | Não | Cadastra usuário — 201 |
| POST | `/api/v1/auth/login` | Não | Inicia sessão — 200 |
| POST | `/api/v1/auth/refresh` | Refresh cookie | Renova access — 204 |
| POST | `/api/v1/auth/logout` | CSRF; access ou refresh válido opcional | Revoga a sessão válida, limpa cookies — 204 |
| GET | `/api/v1/auth/me` | Access cookie | Retorna contexto da sessão — 200 |
| GET | `/api/v1/auth/csrf` | Não | Define cookie e retorna token CSRF — 200 |
| POST | `/api/v1/auth/password-reset` | Não | Solicita link — 202 |
| POST | `/api/v1/auth/password-reset/confirm` | Não | Troca senha — 204 |

O controller de `/auth/register` pertence à apresentação de `auth`, mas chama o
caso de uso público do módulo `users`. `/auth/me` devolve somente `userId` e
`sessionId`; o perfil completo é obtido em `/users/me`.

O cadastro não autentica automaticamente. O logout tenta validar o access token
e, em seguida, o refresh token com hash persistido para identificar a sessão; se
ambos estiverem ausentes ou inválidos, ainda limpa os cookies e responde 204,
sem tentar revogar uma sessão desconhecida. A resposta de `GET /csrf` usa
`Cache-Control: no-store, private` e `Pragma: no-cache`.

## Erros esperados

- `VALIDATION_ERROR`: entrada inválida;
- `UNAUTHORIZED`: credenciais ou sessão inválidas;
- `FORBIDDEN`: operação autorizada para um usuário, mas não permitida;
- `VALIDATION_ERROR`: usado nesta implementação para token de recuperação
  inválido, expirado ou usado, pois o contrato HTTP compartilhado ainda não
  define um código mais específico.

Login nunca deve usar `FORBIDDEN` para distinguir usuário inativo. Falha do
Resend não muda a resposta 202 da solicitação. Mensagens de login e recuperação
devem evitar enumeração.

## Segurança e logs

- usar comparação segura para hashes;
- nunca registrar senha, JWT, cookies, token de reset ou URL completa;
- aplicar resposta e tempo de processamento tão uniformes quanto praticável;
- invalidar token após o primeiro uso;
- revogar sessões após troca de senha;
- validar usuário ativo em toda autenticação;
- permitir CORS com credenciais somente para origens configuradas;
- aplicar a proteção CSRF aprovada às requisições mutáveis;
- registrar eventos em português com IDs técnicos e resultado da operação;
- tratar metadata como dado de auditoria potencialmente sensível;
- não registrar metadata completa em logs;
- não usar localização, IP, `userAgent` ou `deviceId` para autorizar ou negar
  operações nesta versão.

## Backlog de análise contextual

O uso da metadata para detectar recuperação em localização diferente, novo
dispositivo ou contexto incomum fica no backlog. Análise equivalente no login
exigirá ampliar `RefreshToken` ou criar uma entidade própria de auditoria, pois
o modelo atual de refresh armazena somente IP e `userAgent`. A implementação
futura deve definir regras de risco, origem confiável dos sinais, retenção,
tratamento de VPN e proxies, falsos positivos e forma de notificar o usuário
antes de interferir em qualquer fluxo de autenticação.

## Backlog de encerramento de pendências

Um processo agendado deve buscar registros pendentes cujo `expiresAt` já passou.
Ele marca `PasswordResetRequest` e desafios vencidos como `EXPIRED`. Registros
que não podem ser processados recebem `FAILED`. Esse job não envia e-mails, não
troca senhas e não autentica usuários.

As relações obrigatórias de `RefreshToken` e `PasswordResetRequest` com `User`
usam `onDelete: Cascade`. A exclusão definitiva do usuário remove esses
registros. `Challenge` permanece polimórfico e não possui foreign key direta.

Metadata acompanha a vida do registro em que está armazenada. A exclusão do
registro também remove a metadata; desafios polimórficos vinculados a uma
solicitação devem ser apagados explicitamente na mesma transação.

## Ordem das migrations

As migrations podem ser pequenas e revisadas separadamente. A ordem prevista
até o momento é:

1. `create-users`;
2. `create-storage`;
3. `create-refresh-tokens`;
4. `create-password-reset-requests`;
5. `create-challenges`.

`create-storage` pertence ao módulo `storage`. As migrations de refresh,
recuperação e desafios pertencem a `auth` e dependem da existência de `User`.
`create-messaging-identities` permanece futura e não autorizada enquanto a
especificação de mensageria estiver em draft.

Cada migration deve ser gerada com `--create-only`, revisada e aplicada somente
no banco local de desenvolvimento.
