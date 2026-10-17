# Design técnico — módulo de storage

## Organização Onion Architecture

```text
storage/
├── domain/
│   ├── entities/
│   ├── enums/
│   ├── errors/
│   └── repositories/
├── application/
│   ├── contracts/
│   ├── dto/
│   └── use-cases/
└── infrastructure/
    ├── repositories/
    └── storage/
        ├── r2-client.ts
        ├── r2-storage.service.ts
        └── storage.utils.ts
```

O módulo não possui camada `presentation`, controller ou rota própria. Prisma e
o SDK do Cloudflare R2 ficam na infraestrutura. Domínio e aplicação trabalham
com tipos próprios e contratos injetados pelo `Composition Root`.

Os nomes de arquivo acima são uma proposta de organização. O requisito é
separar as responsabilidades e manter toda a integração específica do R2 na
infraestrutura de `storage`, não preservar exatamente esses nomes.

## Extração da integração R2 existente

O ponto de partida é
`backend/src/shared/infrastructure/integrations/aws/s3.service.ts`. Embora a
classe se chame `R2Client`, ela também implementa `IStorageProvider`: lê a
configuração do ambiente, instancia `S3Client`, executa `PutObjectCommand` e
gera URL assinada com `GetObjectCommand`. Essa mistura deve ser desfeita:

1. O client R2 configura endpoint, região, credenciais e bucket para o SDK
   compatível com S3. Ele não representa um caso de uso de imagens.
2. O serviço R2 recebe o client configurado e executa as operações do bucket
   exigidas pela porta `StorageProvider`.
3. O `Composition Root` conecta client, serviço e caso de uso. Domínio e
   aplicação não importam `S3Client`, comandos do SDK nem variáveis de ambiente.
4. `users` deixa de importar `IStorageProvider` e utilitários de storage do
   `shared`. Seu caso de uso chama o contrato público `StorageOperations`.

O nome `S3Client` e os nomes dos comandos permanecem apenas como detalhes da
biblioteca de compatibilidade; nomes de serviços, pastas e adapters próprios do
projeto devem comunicar que o provider é Cloudflare R2. A geração da chave do
objeto passa a pertencer ao fluxo de `storage` e não deve continuar como chave
fixa derivada apenas do ID do usuário, pois substituições precisam de chaves
distintas. Os utilitários de chave, hoje em
`backend/src/shared/application/storage/utils/storage.utils.ts`, também serão
migrados para `storage`. A URL de leitura, quando necessária, será pré-assinada
com expiração de 30 minutos.

A migração deve atualizar consumidores, composição e testes antes de remover o
arquivo e a interface antigos de `shared`. Se for necessário um encaminhamento
temporário para manter a aplicação compilando, ele deve ser eliminado na
integração final; não deve haver dois serviços R2 ativos no resultado.

O módulo que conhece o contexto recebe a requisição HTTP, extrai o arquivo,
valida existência, status e autorização do recurso e chama `storage` por
contrato público. Assim, `contextType`, `contextId` e `ownerUserId` são
definidos pelo backend, e nunca pelo frontend. `storage` valida apenas o arquivo
e as regras genéricas de armazenamento; não consulta o módulo proprietário.

## Entidade `StoredFile`

```typescript
interface StoredFileProperties {
  id: string;
  ownerUserId: string;
  contextType: StorageContextType;
  contextId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeInBytes: number;
  checksum: string;
  status: StorageStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

class StoredFile {
  constructor(properties: StoredFileProperties);
  startUpload(at: Date): void;
  complete(at: Date): void;
  fail(at: Date): void;
}

enum StorageContextType {
  USER_PROFILE = "USER_PROFILE",
  GROUP_COVER = "GROUP_COVER",
  TRANSACTION_ATTACHMENT = "TRANSACTION_ATTACHMENT",
  RECEIPT = "RECEIPT",
}

enum StorageStatus {
  PROCESSING = "PROCESSING",
  UPLOADING = "UPLOADING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

enum StorageProvider {
  CLOUDFLARE_R2 = "CLOUDFLARE_R2",
}
```

`ownerUserId` possui relação real com `User`. Essa foreign key protege a
integridade referencial, mas não substitui a validação de usuário ativo ou de
autorização em `users`. `contextType + contextId` forma um vínculo polimórfico
e não recebe uma foreign key genérica. O caso de uso consumidor valida o
destino antes de chamar `storage`.

Embora `deletedAt` possa permanecer no modelo para outros ciclos de vida
futuros, ele não representa a troca de imagem. A substituição usa remoção real
do registro e do objeto, por meio de `deleteById` e do provider de storage.

Somente `USER_PROFILE` é implementado nesta entrega. Os demais valores reservam
nomes estáveis para funcionalidades futuras, sem criar rotas ou casos de uso.

## Estados

```text
PROCESSING -> UPLOADING -> COMPLETED
                  |
                  +------> FAILED
```

`PROCESSING` representa o registro inicial e a preparação do arquivo.
`UPLOADING` representa o envio ao R2. `COMPLETED` permite uso pelo contexto e
`FAILED` registra falha terminal. Registros `FAILED` permanecem para limpeza
posterior; uma rotina futura fará a remoção definitiva.

## Contratos da aplicação

```typescript
interface StoredFileInput {
  ownerUserId: string;
  contextType: StorageContextType;
  contextId: string;
  originalName?: string | null;
  mimeType: string;
  content: Buffer;
}

interface StorageOperations {
  upload(key: string, content: Buffer, mimeType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  replaceFileContent(input: StoredFileInput): Promise<StoredFileOutput>;
}

interface StoredFileRepository {
  create(file: StoredFile): Promise<StoredFile>;
  findActiveByContext(
    contextType: StorageContextType,
    contextId: string,
  ): Promise<StoredFile | null>;
  updateStatus(id: string, status: StorageStatus): Promise<StoredFile>;
  deleteById(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

interface ObjectStorageProvider {
  upload(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  getPresignedUrl(key: string, expiresInSeconds: number): Promise<string>;
}
```

`StorageOperations` é o contrato público consumido por `users` e implementado
por `StorageService`. Ele expõe upload, exclusão, URL pré-assinada e
`replaceFileContent`. `StorageService` usa `ObjectStorageProvider`, implementado
pelo adapter R2, para executar as operações externas. O caso de uso de `users`
verifica o usuário ativo, a autorização e os IDs antes de chamar o contrato.
`storage` recebe esses dados como entrada interna confiável, mas continua
validando presença, formato e invariantes de armazenamento. Ele não possui
`UsersStorageGateway` nem lógica específica de usuário ativo. As assinaturas
finais devem usar DTOs definidos na aplicação, sem tipos do Multer, Prisma ou
SDK do R2. `StoredFileOutput` usa URL pré-assinada de 30 minutos quando a URL for
necessária; a operação de substituição segue a compensação definida para
registros `FAILED`.

`StoredFileOutput` usa URL pré-assinada de 30 minutos quando aplicável. A operação
de substituição é total: o repository remove o registro anterior e o provider
remove o objeto anterior antes de salvar a nova imagem.

## Validação do arquivo

O caso de uso deve validar o arquivo em camadas, antes de qualquer operação no
R2:

1. Confirmar que o arquivo existe, possui buffer não vazio e não ultrapassa
   10 MB.
2. Validar o MIME declarado pela requisição.
3. Identificar o tipo real pelos bytes do arquivo, usando sua assinatura
   binária (*magic bytes*).
4. Comparar o tipo detectado com o MIME declarado.
5. Decodificar a imagem para rejeitar conteúdo corrompido ou incompatível.
6. Calcular o checksum SHA-256 dos bytes validados.

O fluxo inicial de perfil aceita PNG, JPEG e WebP. PDF não passa por esse fluxo;
quando for habilitado, deverá possuir validação específica. A extensão do nome
original nunca é suficiente para aprovar um arquivo.

## Caso de uso — substituir imagem por contexto

`StorageService.replaceFileContent` recebe um arquivo e um contexto já autorizado pelo
módulo consumidor. Ele não valida se o proprietário é usuário, grupo ou outra
entidade. Sua responsabilidade é substituir integralmente o recurso de imagem:

1. **Input:** recebe `ownerUserId`, `contextType`, `contextId` e o arquivo
   validado pelo módulo consumidor.
2. **Validação:** verifica os invariantes genéricos do arquivo e a presença dos
   identificadores internos. A autorização e a validação do recurso de destino
   pertencem ao módulo consumidor.
3. **Consulta:** procura a imagem existente para o par `contextType` e
   `contextId`.
4. **Remoção:** se existir uma imagem, remove o objeto do R2 e o registro no
   repository.
5. **Armazenamento:** gera uma nova chave, envia o arquivo ao R2 e persiste um
   novo registro `StoredFile` com status e metadados correspondentes.
6. **Falha:** aplica a estratégia de compensação aprovada para evitar registros
   ou objetos órfãos.
7. **Resposta:** retorna a representação pública aprovada da nova imagem.

O contrato `ObjectStorageProvider` é interno à infraestrutura e representa as
operações do R2. `StorageOperations` é o contrato público usado por `users`; ele
expõe upload, exclusão e URL pré-assinada, além de `replaceFileContent`, que
coordena validação, persistência, substituição e URL temporária. `StorageService`
delega as operações de objeto ao adapter R2.

## Fluxo — substituir imagem de perfil

1. **Input:** `users` recebe o arquivo do controller e o `userId` autenticado.
2. **Validação:** `users` confere o usuário ativo e a propriedade pelo ID
   autenticado; sua apresentação valida presença, tamanho e tipo do arquivo.
   `storage` valida somente os invariantes genéricos do arquivo e do storage.
3. **Use case:** `users` define `USER_PROFILE`, `ownerUserId` e `contextId`
   iguais ao ID autenticado e chama `StorageOperations.replaceFileContent`.
4. **Módulos:** `storage` não consulta `users`; envia o objeto por
   `ObjectStorageProvider` para Cloudflare R2.
5. **Persistência:** `storage` remove o objeto e o registro anteriores, envia a
   nova imagem e salva `StoredFile` com os IDs, contexto e `CLOUDFLARE_R2` recebidos
   de `users`.
6. **Resposta:** retorna somente o identificador e a representação pública
   aprovada da imagem.

## Persistência e índices

- foreign key de `ownerUserId` para `User.id` com `onDelete: Cascade`;
- índice único para `storageProvider + storageKey`;
- índices para consultas por proprietário e status.

Não haverá índice único por `contextType + contextId`. A regra de substituição
será aplicada pelo caso de uso e pelo repository, conforme a consistência
definida para a operação.

## Ordem das migrations

O schema pode ser dividido em migrations pequenas e revisáveis:

1. `create-users`;
2. `create-storage`;
3. `create-refresh-tokens`;
4. `create-password-reset-requests`;
5. `create-challenges`.

`create-messaging-identities` permanece como migration futura e não autorizada,
pois o módulo de mensageria ainda está em draft.

Essa ordem permite a foreign key de `StoredFile.ownerUserId`. As migrations devem ser
geradas e revisadas antes de qualquer aplicação em ambiente compartilhado. A
configuração de `DATABASE_URL` pode ser feita depois da primeira versão do
`schema.prisma`, mas é necessária para gerar e executar migrations reais.

## Segurança

- nunca confiar em IDs de proprietário ou contexto enviados pelo cliente;
- não usar o nome original como chave do R2;
- validar conteúdo, MIME e tamanho antes de disponibilizar a imagem;
- não registrar conteúdo, URL assinada ou dados pessoais em logs;
- usar credenciais do R2 apenas na infraestrutura;
- confirmar propriedade e contexto no caso de uso consumidor, antes de chamar
  `storage`;
- limitar memória e quantidade de uploads na borda HTTP.

A implementação atual valida assinatura binária e algumas estruturas de
contêiner, mas ainda não decodifica os pixels. Essa diferença não satisfaz
STR-RF-008: STR-04 permanece bloqueada até que uma dependência de decodificação
seja aprovada e a validação seja implementada.

## Falhas e consistência

A remoção do objeto antigo, o upload do novo objeto e a gravação no PostgreSQL
não compartilham uma transação. O registro da tentativa deve permanecer como
`FAILED` quando houver falha, e os objetos ou registros órfãos serão limpos
posteriormente. Uma rotina futura fará a remoção definitiva desses resíduos.
Há uma falha ainda sem estratégia aprovada: se a exclusão do objeto antigo no
R2 funcionar e a exclusão de seu registro no banco falhar, o registro antigo
permanece `COMPLETED` sem objeto. Essa janela precisa de tratamento e teste antes
de concluir STR-04.

## Restrições de schema confirmadas

- `storageKey`: máximo de 512 caracteres;
- `mimeType`: máximo de 100 caracteres;
- `originalName`: máximo de 255 caracteres;
- `checksum`: SHA-256 obrigatório;
- `StorageStatus`, `StorageContextType` e `StorageProvider` são enums nativos do
  Prisma/PostgreSQL.

Não há índice único por contexto. O lock atual existe apenas no processo e não
garante unicidade entre réplicas; uma estratégia de coordenação compartilhada
precisa ser aprovada e implementada antes de concluir STR-04.

## Backlog

- estratégia operacional da rotina futura de limpeza de registros `FAILED`.
