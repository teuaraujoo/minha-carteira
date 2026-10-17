# Design técnico — módulo de usuários

## Contexto atual

O módulo já possui uma entidade `User`, schema de criação, upload de imagem e um
serviço inicial. O contrato `IUsersRepository` ainda usa `Promise<any>`, possui
métodos sem parâmetros, contém o erro `cpdateUser` e mistura persistência com
ações da aplicação.

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
devem importar Express, Prisma, Multer, Pino, Zod nem erros definidos em
`shared/presentation`. Erros de domínio e aplicação devem ser mapeados para HTTP
somente na borda.

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
  persistir a forma normalizada;
- `name`: remover apenas espaços externos;
- `password`: não aplicar `trim`, pois isso mudaria a credencial;
- `phone`: manter como string; a regra final de formato está pendente.

Índices únicos no banco devem sustentar as regras de e-mail e nome de usuário.
A checagem antecipada melhora a mensagem, mas não substitui a constraint. A
unicidade case-insensitive usa canonicalização em letras minúsculas antes da
persistência. As constraints únicas protegem os valores normalizados. A
migration deve adicionar constraints `CHECK` para impedir valores que não sejam
iguais a `lower(email)` e `lower(username)`, inclusive em escritas externas à
aplicação. `phone` não possui constraint de unicidade. Também é necessário
decidir se `username` pode conter `@`, evitando ambiguidade com e-mail no login.

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

## Integração com o módulo `images`

`Image`, `ImageStatus`, `StorageProvider`, repository e integração com o
Cloudflare R2 pertencem ao módulo `images`. A definição normativa está em
`backend/.specs/features/images/design.md`.

O módulo `users` consome somente `ImagesGateway` para substituir a foto de
perfil. Ele entrega o arquivo e o `userId` autenticado; não acessa o repository
de imagens nem o provider de storage. Em sentido inverso, `images` usa um
contrato público mínimo de `users` para confirmar que o usuário existe e está
ativo.

`images` é interno e não possui camada `presentation`. A rota de upload, o
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
6. **Resposta:** retorna `UserOutput` ou erro em português.

### Fluxo — upload da imagem de perfil

1. **Input:** Multer disponibiliza o arquivo em memória e o middleware fornece
   `request.auth.userId`.
2. **Validação:** Zod valida conteúdo, MIME e tamanho; o cliente não envia ID.
3. **Use case:** encaminha arquivo e contexto autenticado ao módulo `images`.
4. **Módulos:** chama `ImagesGateway.replaceUserProfileImage`.
5. **Persistência:** `images` confirma o usuário ativo por `UsersImagesGateway`,
   armazena o objeto no R2 e salva `Image` com
   `contextType=USER_PROFILE`, `contextId=userId` e `ownerUserId=userId`.
6. **Resposta:** retorna a URL prevista pelo contrato atual.

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

## Rotas propostas

| Método | Rota | Auth | Resultado |
| --- | --- | --- | --- |
| GET | `/api/v1/users/me` | Sim | Perfil atual — 200 |
| PATCH | `/api/v1/users/me` | Sim | Atualiza perfil — 200 |
| POST | `/api/v1/users/me/profile-image` | Sim | Envia imagem — 200 |
| POST | `/api/v1/users/me/deactivate` | Sim | Desativa — 204 |

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

`create-users` é a primeira migration prevista. `create-images` pertence ao
módulo `images` e vem em seguida para poder referenciar `User.id`.

As relações obrigatórias de refresh token, solicitação de reset e imagem com
`User` usam `onDelete: Cascade` na exclusão definitiva. Essa regra não autoriza
a exclusão antecipada nem altera o período de 30 dias de inatividade.

`MessagingIdentity` usa `onDelete: Restrict` provisoriamente. A exclusão do
usuário exige desvinculação explícita até a futura especificação de mensageria
definir sua política final.
