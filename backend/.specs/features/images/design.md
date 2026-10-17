# Design técnico — módulo de imagens

## Organização Onion Architecture

```text
images/
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
        └── r2-storage.service.ts
```

O módulo não possui camada `presentation`, controller ou rota própria. Prisma e
o SDK do Cloudflare R2 ficam na infraestrutura. Domínio e aplicação trabalham
com tipos próprios e contratos injetados pelo `Composition Root`.

Os nomes de arquivo acima são uma proposta de organização. O requisito é
separar as responsabilidades e manter toda a integração específica do R2 na
infraestrutura de `images`, não preservar exatamente esses nomes.

## Extração da integração R2 existente

O ponto de partida é
`backend/src/shared/infrastructure/integrations/aws/s3.service.ts`. Embora a
classe se chame `R2Client`, ela também implementa `IStorageProvider`: lê a
configuração do ambiente, instancia `S3Client`, executa `PutObjectCommand` e
gera URL assinada com `GetObjectCommand`. Essa mistura deve ser desfeita:

1. O client R2 configura endpoint, região, credenciais e bucket para o SDK
   compatível com S3. Ele não representa um caso de uso de imagens.
2. O serviço R2 recebe o client configurado e executa as operações do bucket
   exigidas pela porta `ImageStorageProvider`.
3. O `Composition Root` conecta client, serviço e caso de uso. Domínio e
   aplicação não importam `S3Client`, comandos do SDK nem variáveis de ambiente.
4. `users` deixa de importar `IStorageProvider` e utilitários de storage do
   `shared`. Seu caso de uso passa a chamar apenas `ImagesGateway`.

O nome `S3Client` e os nomes dos comandos permanecem apenas como detalhes da
biblioteca de compatibilidade; nomes de serviços, pastas e adapters próprios do
projeto devem comunicar que o provider é Cloudflare R2. A geração da chave do
objeto passa a pertencer ao fluxo de `images` e não deve continuar como chave
fixa derivada apenas do ID do usuário, pois substituições precisam de chaves
distintas. A política exata de URL, exclusão e compensação continua pendente.

A migração deve atualizar consumidores, composição e testes antes de remover o
arquivo e a interface antigos de `shared`. Se for necessário um encaminhamento
temporário para manter a aplicação compilando, ele deve ser eliminado na
integração final; não deve haver dois serviços R2 ativos no resultado.

O módulo que conhece o contexto recebe a requisição HTTP, extrai o arquivo e
chama um caso de uso de `images` por contrato público. Assim, `contextType`,
`contextId` e `ownerUserId` são definidos pelo backend, e nunca pelo frontend.

## Entidade `Image`

```typescript
interface Image {
  id: string;
  ownerUserId: string;
  contextType: ImageContextType;
  contextId: string;
  storageProvider: StorageProvider;
  storageKey: string;
  originalName: string | null;
  mimeType: string;
  sizeInBytes: number;
  checksum: string | null;
  status: ImageStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

enum ImageContextType {
  USER_PROFILE = "USER_PROFILE",
  GROUP_COVER = "GROUP_COVER",
  TRANSACTION_ATTACHMENT = "TRANSACTION_ATTACHMENT",
  RECEIPT = "RECEIPT",
}

enum ImageStatus {
  PROCESSING = "PROCESSING",
  UPLOADING = "UPLOADING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

enum StorageProvider {
  CLOUDFLARE_R2 = "CLOUDFLARE_R2",
}
```

`ownerUserId` possui relação real com `User`. `contextType + contextId` forma
um vínculo polimórfico e não recebe uma foreign key genérica. O caso de uso deve
validar o destino por uma porta pública do módulo proprietário.

Somente `USER_PROFILE` é implementado nesta entrega. Os demais valores reservam
nomes estáveis para funcionalidades futuras, sem criar rotas ou casos de uso.

## Estados

A sequência abaixo é uma proposta técnica e precisa de aprovação antes da
implementação:

```text
UPLOADING -> PROCESSING -> COMPLETED
     |             |
     +-----------> FAILED
```

`UPLOADING` representa o envio ao R2. `PROCESSING` representa validação ou
tratamento posterior ao recebimento. `COMPLETED` permite uso pelo contexto e
`FAILED` registra falha terminal daquela tentativa.

Se não houver processamento assíncrono no início, deve ser decidido se a imagem
passa brevemente por `PROCESSING` ou se a transição `UPLOADING -> COMPLETED` é
aceita.

## Contratos da aplicação

```typescript
interface ImageFileInput {
  buffer: Uint8Array;
  originalName: string;
  mimeType: string;
  sizeInBytes: number;
}

interface ImagesGateway {
  replaceUserProfileImage(input: {
    userId: string;
    file: ImageFileInput;
  }): Promise<ProfileImageOutput>;
}

interface ImagesRepository {
  save(image: Image): Promise<void>;
  findActiveUserProfile(userId: string): Promise<Image | null>;
  markDeleted(id: string, deletedAt: Date): Promise<void>;
}

interface ImageStorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadOutput>;
  delete(storageKey: string): Promise<void>;
}

interface UsersImagesGateway {
  userExistsAndIsActive(userId: string): Promise<boolean>;
}
```

`ImagesGateway` é a porta consumida por `users`. `UsersImagesGateway` permite
que `images` confirme o contexto sem importar o repository de usuários. As
assinaturas finais devem usar DTOs definidos na aplicação, sem tipos do Multer,
Prisma ou SDK do R2.

A interface atual `IStorageProvider` de `shared` não é o contrato definitivo:
ela recebe `Buffer`, retorna `unknown` no upload e oferece URL assinada sem
definir o retorno público de `images`. A interface final deve refletir as
operações realmente aprovadas para o fluxo; o exemplo acima ainda depende das
decisões pendentes de exclusão e representação de URL.

## Fluxo — substituir imagem de perfil

1. **Input:** `users` recebe o arquivo do controller e o `userId` autenticado.
2. **Validação:** a apresentação de `users` valida presença, tamanho e tipo;
   `images` repete os invariantes que protegem o caso de uso.
3. **Use case:** `users` chama `ImagesGateway.replaceUserProfileImage` sem
   aceitar `ownerUserId` ou `contextId` do cliente.
4. **Módulos:** `images` valida o usuário por `UsersImagesGateway` e envia o
   objeto por `ImageStorageProvider`.
5. **Persistência:** salva `Image` com `USER_PROFILE`, IDs derivados do usuário
   autenticado e `CLOUDFLARE_R2`; substitui logicamente o registro anterior.
6. **Resposta:** retorna somente o identificador e a representação pública
   aprovada da imagem.

## Persistência e índices

- foreign key de `ownerUserId` para `User.id` com `onDelete: Cascade`;
- índice único para `storageProvider + storageKey`;
- índice para `contextType + contextId + deletedAt`;
- no máximo uma imagem `USER_PROFILE` ativa por usuário;
- índices para consultas por proprietário e status.

A unicidade condicional da imagem ativa pode exigir índice parcial escrito em
SQL na migration. A estratégia precisa ser aprovada antes da implementação.

## Ordem das migrations

O schema pode ser dividido em migrations pequenas e revisáveis:

1. `create-users`;
2. `create-images`;
3. `create-refresh-tokens`;
4. `create-password-reset-requests`;
5. `create-challenges`.

`create-messaging-identities` permanece como migration futura e não autorizada,
pois o módulo de mensageria ainda está em draft.

Essa ordem permite a foreign key de `Image.ownerUserId`. As migrations devem ser
geradas e revisadas antes de qualquer aplicação em ambiente compartilhado. A
configuração de `DATABASE_URL` pode ser feita depois da primeira versão do
`schema.prisma`, mas é necessária para gerar e executar migrations reais.

## Segurança

- nunca confiar em IDs de proprietário ou contexto enviados pelo cliente;
- não usar o nome original como chave do R2;
- validar conteúdo, MIME e tamanho antes de disponibilizar a imagem;
- não registrar conteúdo, URL assinada ou dados pessoais em logs;
- usar credenciais do R2 apenas na infraestrutura;
- confirmar propriedade e contexto no servidor;
- limitar memória e quantidade de uploads na borda HTTP.

## Falhas e consistência

O upload no R2 e a gravação no PostgreSQL não compartilham uma transação. Antes
da implementação, deve ser aprovada uma estratégia de compensação para remover
objetos órfãos ou permitir reprocessamento seguro.

## Decisões pendentes para o schema

- índice parcial para foto de perfil ativa;
- comprimento máximo de `storageKey`, MIME e nome original;
- representação do enum no banco;
- política de retenção e remoção dos objetos.
