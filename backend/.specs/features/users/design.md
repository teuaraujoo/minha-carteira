# Design técnico — módulo de usuários

## Contexto atual

O módulo possui a entidade `User`, cadastro público, persistência Prisma
preparada, gateway público consumido por `auth`, consulta e atualização do
próprio perfil e upload de imagem integrado a `storage`. O contrato
`IUsersRepository` está tipado e separado da implementação. A validação real da
persistência em PostgreSQL e os testes HTTP integrados das rotas autenticadas
continuam pendentes; o ciclo de vida e a limpeza definitiva também não foram
implementados.

## Organização Onion Architecture

```text
users/
├── domain/
│   ├── entities/
│   ├── enums/
│   ├── errors/
│   └── repositories/
├── application/
│   ├── contracts/
│   ├── dto/
│   ├── presenters/
│   └── use-cases/
├── infrastructure/
│   └── repositories/
└── presentation/
    ├── controllers/
    ├── routes/
    └── schemas/
```

O `Composition Root` injeta implementações concretas. Domínio e aplicação não
devem importar Express, Prisma, Multer, Pino ou Zod. Para erros, o código atual
reutiliza o `AppError` global compartilhado, conforme a convenção do projeto; a
apresentação converte erros em respostas HTTP.

## Entidade `User`

### Propriedades

```typescript
interface User {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoles;
  passwordHash: string;
  capabilities: UserCapabilities[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
}
```

`role` usa o enum `UserRoles` com `USER` e `ADMIN`. `capabilities` continua
como uma coleção do enum `UserCapabilities`; não existem tabelas `Capability`
ou `UserCapability`. O cadastro público sempre cria `USER` e não recebe role ou
capabilities do cliente. A role controla responsabilidades amplas, enquanto
capabilities liberam funcionalidades específicas, como a integração com
Telegram.

O nome correto é `inactivatedAt`. A grafia atual `inactivetedAt` deve ser
corrigida de forma coordenada em entidade, persistência e testes.

### Comportamentos mínimos

- getters defensivos para os dados públicos;
- `isActive()`;
- `updateProfile(...)`;
- `changePasswordHash(...)`, usado somente por contrato interno;
- `activate()` e `deactivate()`;
- `grantCapability(...)`, `revokeCapability(...)` e `hasCapability(...)`;
- atualização determinística de `updatedAt` por `ClockProvider` ou data
  recebida.

O construtor de reidratação não deve gerar identificadores nem datas. Uma
factory de criação pode receber esses valores por providers.

## Normalização

- `email`: remover espaços externos e persistir em letras minúsculas;
- `username`: remover espaços externos, converter para letras minúsculas e
  persistir a forma normalizada; rejeitar `@` para distingui-lo de e-mail no
  campo de login `identifier`;
- `name`: remover apenas espaços externos;
- `password`: não aplicar `trim`, pois isso mudaria a credencial;
- `phone`: manter como string; a regra final de formato está pendente.

Índices únicos no banco devem sustentar as regras de e-mail e nome de usuário.
A checagem antecipada melhora a mensagem, mas não substitui a constraint. A
unicidade case-insensitive usa canonicalização em letras minúsculas antes da
persistência. As constraints únicas protegem os valores normalizados. A
migration deve adicionar constraints `CHECK` para impedir valores que não sejam
iguais a `lower(email)` e `lower(username)`, inclusive em escritas externas à
aplicação. `phone` não possui constraint de unicidade. A apresentação rejeita
`@` em username; o login classifica identificadores com `@` como e-mail e os
demais como username.

## Contrato de persistência

O repository deve representar operações de persistência, não ações de negócio:

```typescript
interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findActiveById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByIdentifier(identifier: string): Promise<User | null>;
  save(user: User): Promise<void>;
  deleteById(id: string): Promise<void>;
  findInactiveBefore(
    date: Date,
    pagination: PaginationInput,
  ): Promise<PaginatedResult<User>>;
}
```

`registerUser`, `inactiveUser`, `activeUser` e `updateUser` pertencem a casos de
uso. Capabilities podem ser lidas da própria entidade; não exigem um método
`findUserCapabilities` separado.

## Contrato público para `auth`

O módulo deve expor uma fachada mínima, por exemplo:

```typescript
interface UsersAuthGateway {
  findCredentialsByIdentifier(
    identifier: string,
  ): Promise<AuthUserCredentials | null>;
  findActiveUserById(userId: string): Promise<AuthUser | null>;
  changePasswordHash(userId: string, passwordHash: string): Promise<void>;
}
```

`AuthUserCredentials` pode conter `passwordHash` porque é um contrato interno
entre módulos. Ele nunca deve atravessar a camada de apresentação.

O caso de uso de cadastro também é exposto como contrato público para a
apresentação de `auth`. O módulo `users` continua dono da regra e da
persistência; `auth` é dono da rota pública `/auth/register`.

## DTOs de aplicação

- `RegisterUserInput` e `RegisterUserOutput`;
- `GetCurrentUserInput` e `UserOutput`;
- `UpdateCurrentUserInput` e `UserOutput`;
- `DeactivateUserInput`;
- `ReactivateUserInput`;
- `DeleteInactiveUsersInput` e `DeleteInactiveUsersResult`;
- `UploadProfileImageInput` e `UploadProfileImageResult`.

DTOs de saída usam um mapper explícito para impedir exposição acidental do hash.

Quando houver imagem de perfil concluída, `UserOutput` inclui:

```typescript
interface ProfileImageView {
  id: string;
  url: string;
  expiresAt: Date;
}
```

`url` é uma URL pré-assinada temporária, válida por 30 minutos. `expiresAt`
indica o instante de expiração em UTC. A URL não é persistida como dado do
usuário e o frontend deve solicitar uma nova representação quando ela expirar.

## Integração com o módulo `storage`

`StoredFile`, `StorageStatus`, `StorageProvider`, repository e integração com o
Cloudflare R2 pertencem ao módulo `storage`. A definição normativa está em
`backend/.specs/features/storage/design.md`.

O módulo `users` consome somente `StorageOperations` para substituir a foto de
perfil. Antes da chamada, `users` consulta o próprio repository, verifica se o
usuário autenticado existe e está ativo e define `ownerUserId`, `contextId` e
`USER_PROFILE`. Ele entrega esses dados e o arquivo ao contrato genérico de
`storage`, sem acessar o repository de arquivos nem o provider de storage.
`storage` não consulta `users` e não decide sobre status ou autorização.

`storage` é interno e não possui camada `presentation`. A rota de upload, o
Multer e a autenticação permanecem em `users`. O frontend não escolhe o contexto
da imagem.

## Fluxos

### Fluxo — cadastro público

1. **Input:** controller de `auth` recebe `username`, `name`, `email`, `phone` e
   `password`.
2. **Validação:** a apresentação de `auth` usa Zod para validar formato, campos
   permitidos e tamanho mínimo atual da senha.
3. **Use case:** chama o contrato público de cadastro de `users`, que normaliza
   os identificadores e consulta duplicidade.
4. **Módulos:** usa `PasswordHasher`, `IdGenerator` e `ClockProvider`.
5. **Persistência:** cria `User` ativo e executa `save`.
6. **Resposta:** presenter retorna `UserOutput`, sem `passwordHash`, com 201.

### Fluxo — consulta do próprio perfil

1. **Input:** middleware fornece `request.auth.userId`.
2. **Validação:** controller não aceita `userId` do cliente.
3. **Use case:** procura usuário ativo pelo identificador autenticado.
4. **Módulos:** somente `users` participa.
5. **Persistência:** repository consulta por `id` e `status`.
6. **Resposta:** retorna `UserOutput`, incluindo `profileImage.url` e
   `profileImage.expiresAt` quando houver imagem concluída, ou erro em português.

### Fluxo — upload da imagem de perfil

1. **Input:** Multer disponibiliza o arquivo em memória e o middleware fornece
   `request.auth.userId`.
2. **Validação:** Zod valida conteúdo, MIME e tamanho; o caso de uso de `users`
   consulta o próprio repository e confirma usuário existente e ativo. O
   cliente não envia IDs de proprietário ou contexto.
3. **Use case:** define `contextType=USER_PROFILE`, `contextId=userId` e
   `ownerUserId=userId`, usando somente o ID autenticado.
4. **Módulos:** chama `StorageOperations.replaceFileContent`; `storage` não consulta
   o módulo de usuários.
5. **Persistência:** `storage` remove a imagem de perfil anterior, apaga seu
   objeto no R2, armazena o novo objeto e salva `StoredFile` com os identificadores
   e o contexto validados por `users`.
6. **Resposta:** retorna, quando necessário, uma URL pré-assinada temporária
   com expiração de 30 minutos.

### Fluxo — desativação

1. **Input:** recebe o `userId` autenticado.
2. **Validação:** confirma usuário existente e ativo.
3. **Use case:** chama `deactivate(now)` na entidade.
4. **Módulos:** solicita a `auth` a revogação de todos os refresh tokens por
   contrato público `RefreshTokensGateway`, sem acessar seu repository.
5. **Persistência:** salva `status`, `inactivatedAt` e `updatedAt`.
6. **Resposta:** confirma a operação sem expor dados internos.

### Fluxo — exclusão de inativos

1. **Input:** processo interno recebe data de corte e paginação.
2. **Validação:** data de corte corresponde a mais de 30 dias de inatividade.
3. **Use case:** lista usuários elegíveis.
4. **Módulos:** coordena a limpeza dos recursos que não usam cascata.
5. **Persistência:** remove somente usuários elegíveis dentro de transação; as
   sessões, solicitações de reset e imagens vinculadas são removidas em cascata.
   Uma identidade de mensageria ainda vinculada bloqueia a exclusão até que sua
   política definitiva seja aprovada.
6. **Resposta:** registra apenas contagens e IDs técnicos permitidos no log.

## Rotas implementadas e planejadas

| Método | Rota | Auth | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/users/me` | Sim | Perfil atual — 200; implementada |
| PATCH | `/api/v1/users/me` | Sim | Atualiza nome e telefone — 200; implementada |
| POST | `/api/v1/users/me/profile-image` | Sim | Envia imagem — 200; implementada |
| POST | `/api/v1/users/me/deactivate` | Sim | Desativa — 204; planejada, não implementada |

A rota de reativação depende da definição de produto: um usuário inativo não
possui sessão válida. Ela deve ser administrativa ou integrada a um fluxo
específico de reativação antes de ser exposta.

O cadastro é listado apenas no design de `auth`, que possui seu controller HTTP.
O caso de uso e a persistência continuam no módulo `users`.

## Erros esperados

- `VALIDATION_ERROR`: entrada inválida;
- `CONFLICT`: e-mail ou nome de usuário já utilizado;
- `NOT_FOUND`: usuário não encontrado no contexto autorizado;
- `UNAUTHORIZED`: ausência de contexto autenticado;
- `FORBIDDEN`: operação administrativa sem autorização.

Todas as mensagens devem estar em português do Brasil.

## Segurança

- nunca confiar em `userId` fornecido pelo cliente para operações próprias;
- não incluir senha, hash, e-mail completo ou telefone em logs;
- conferir propriedade do recurso no servidor;
- usar resposta genérica quando a diferença revelar existência de usuário;
- limitar tamanho e MIME do upload antes do armazenamento;
- evitar que nomes originais de arquivos componham a chave do objeto;
- validar `contextType + contextId` no servidor;
- não usar apenas o contexto polimórfico como prova de propriedade;
- garantir que role `ADMIN` não conceda acesso automático aos dados financeiros
  de outros usuários.

## Dependências compartilhadas

`PasswordHasher` é uma porta compartilhada da aplicação com adapter bcrypt na
infraestrutura compartilhada. Sua definição e implementação devem preceder o
cadastro e o login. Assim, `users` não depende de uma implementação interna de
`auth`, e `auth` não depende do repository de `users`.

## Testes

- entidade: criação, ativação, desativação, role, capabilities e atualização;
- casos de uso: cadastro, duplicidade, perfil, atualização e upload;
- repository: mapeamento completo, constraints e consultas por identificador;
- apresentação: schemas, contexto autenticado e contratos HTTP;
- segurança: ausência de `passwordHash` e proteção contra IDOR.

## Migração e compatibilidade

A migração de banco deve ser especificada e aprovada separadamente antes de ser
executada. A implementação precisa corrigir `inactivetedAt` para
`inactivatedAt` sem perder dados existentes, caso a coluna já exista.

`create-users` é a primeira migration prevista. `create-storage` pertence ao
módulo `storage` e vem em seguida para poder referenciar `User.id`.

As relações obrigatórias de refresh token, solicitação de reset e imagem com
`User` usam `onDelete: Cascade` na exclusão definitiva. Essa regra não autoriza
a exclusão antecipada nem altera o período de 30 dias de inatividade.

`MessagingIdentity` usa `onDelete: Restrict` provisoriamente. A exclusão do
usuário exige desvinculação explícita até a futura especificação de mensageria
definir sua política final.
