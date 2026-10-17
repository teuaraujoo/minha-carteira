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
     |            |
     +------------+------> FAILED
```

`PROCESSING` representa o registro inicial e a preparação do arquivo.
`UPLOADING` representa o envio ao R2. Ambos podem terminar em `FAILED` em caso
de falha. `COMPLETED` permite uso pelo contexto. Registros `FAILED` permanecem
para limpeza posterior; uma rotina futura fará a remoção definitiva. Se nem o
registro inicial puder ser persistido, não existe linha para marcar `FAILED`.
Se o banco estiver indisponível durante a atualização de status, não é possível
garantir que a linha registre a falha naquele momento.

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
de substituição é total: a imagem nova precisa estar `COMPLETED` antes de o
serviço remover o objeto e o registro anteriores.

## Validação do arquivo

O caso de uso deve validar o arquivo em camadas, antes de qualquer operação no
R2:

1. Confirmar que o arquivo existe, possui buffer não vazio e não ultrapassa
   10 MB.
2. Validar o MIME declarado pela requisição.
3. Identificar o tipo real pelos bytes do arquivo, usando sua assinatura
   binária (*magic bytes*).
4. Comparar o tipo detectado com o MIME declarado.
5. Conferir a estrutura básica do contêiner, sem decodificar os pixels.
6. Calcular o checksum SHA-256 dos bytes que passaram pelas validações.

O fluxo inicial de perfil aceita PNG, JPEG e WebP. PDF não passa por esse fluxo;
quando for habilitado, deverá possuir validação específica. A extensão do nome
original nunca é suficiente para aprovar um arquivo. A decodificação completa
fica para o backlog; o fluxo atual não redimensiona nem transforma imagens.

## Caso de uso — substituir imagem por contexto

`StorageService.replaceFileContent` recebe um arquivo e um contexto já autorizado pelo
módulo consumidor. Ele não valida se o proprietário é usuário, grupo ou outra
entidade. Sua responsabilidade é substituir integralmente o recurso de imagem,
preservando a imagem atual até a nova tentativa ser concluída:

1. **Input:** recebe `ownerUserId`, `contextType`, `contextId` e o arquivo
   validado pelo módulo consumidor.
2. **Validação:** verifica os invariantes genéricos do arquivo e a presença dos
   identificadores internos. A autorização e a validação do recurso de destino
   pertencem ao módulo consumidor.
3. **Consulta:** procura a imagem existente para o par `contextType` e
   `contextId`.
4. **Tentativa:** cria um novo registro `PROCESSING`, muda para `UPLOADING`,
   envia o novo objeto ao R2 e obtém sua URL temporária. A imagem anterior
   permanece `COMPLETED` durante essas etapas.
5. **Conclusão:** persiste a nova imagem como `COMPLETED`; a partir desse ponto,
   a tentativa é considerada bem-sucedida.
6. **Limpeza anterior:** remove o objeto e o registro anteriores. Se a limpeza
   falhar, a nova imagem continua sendo o resultado bem-sucedido, e o registro
   ou objeto residual fica para limpeza posterior.
7. **Falha da nova tentativa:** antes da conclusão, marca o novo registro como
   `FAILED`, tenta remover eventual objeto novo parcialmente enviado e mantém a
   imagem anterior ativa. O erro retorna ao módulo consumidor para ser
   apresentado ao usuário. A marcação depende de o registro existir e de o
   banco aceitar a atualização; se o banco estiver indisponível, o status pode
   permanecer em estado anterior.
8. **Resposta:** retorna a representação pública aprovada da nova imagem após
   ela estar `COMPLETED`.

O contrato `ObjectStorageProvider` é interno à infraestrutura e representa as
operações do R2. `StorageOperations` é o contrato público usado por `users`; ele
expõe upload, exclusão e URL pré-assinada, além de `replaceFileContent`, que
coordena validação, persistência, substituição e URL temporária. `StorageService`
delega as operações de objeto ao adapter R2.

## Fluxo — substituir imagem de perfil

1. **Input:** `users` recebe o arquivo do controller e o `userId` autenticado.
2. **Validação:** `users` confere o usuário ativo e a propriedade pelo ID
   autenticado; sua apresentação valida presença, tamanho e tipo do arquivo.
   `storage` verifica assinatura e estrutura básica, sem decodificar pixels.
3. **Use case:** `users` define `USER_PROFILE`, `ownerUserId` e `contextId`
   iguais ao ID autenticado e chama `StorageOperations.replaceFileContent`.
4. **Tentativa:** `storage` cria a nova linha `PROCESSING`, envia o objeto pelo
   `ObjectStorageProvider` e conclui a nova linha como `COMPLETED`, mantendo a
   linha anterior ativa até então.
5. **Falha:** se o envio ou a persistência da nova imagem falhar, `storage`
   marca a nova linha como `FAILED`, tenta limpar o objeto parcial e propaga o
   erro; a linha e o objeto anteriores permanecem ativos.
6. **Limpeza:** após concluir a nova linha, `storage` tenta remover o objeto e
   o registro anteriores. Uma falha nessa limpeza não invalida a nova imagem
   concluída; a consulta prioriza o registro concluído mais recente.
7. **Resposta:** retorna a URL pré-assinada e seu `expiresAt` somente para a
   nova imagem concluída.

## Persistência e índices

- foreign key de `ownerUserId` para `User.id` com `onDelete: Cascade`;
- índice único para `storageProvider + storageKey`;
- índices para consultas por proprietário e status.

Não haverá índice único por `contextType + contextId`. Nesta etapa, a
serialização por contexto usa um lock em memória e cobre uma única instância do
processo Node.js. Se a aplicação passar a executar em várias instâncias, será
necessário adotar coordenação compartilhada antes de garantir a exclusividade
entre elas.

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

O escopo atual valida assinatura binária e estrutura básica dos contêineres,
mas não decodifica os pixels. Isso é suficiente para o fluxo atual, que apenas
armazena e entrega os arquivos; processamento e redimensionamento estão fora do
escopo. Uma validação por decodificação poderá ser adicionada se o sistema
passar a transformar imagens.

## Falhas e consistência

A remoção do objeto antigo, o upload do novo objeto e a gravação no PostgreSQL
não compartilham uma transação. A implementação mantém a imagem anterior ativa
até a nova estar `COMPLETED`. Falhas antes desse ponto marcam a nova tentativa
como `FAILED`; a anterior permanece ativa. Depois da conclusão, falhas ao
limpar a anterior não anulam o sucesso; resíduos podem ser removidos por rotina
futura, e a consulta prioriza a imagem concluída mais recente.
O lock em memória serializa operações concorrentes na mesma instância. Ele não
coordena processos ou instâncias diferentes; essa escala não faz parte da
implantação atual e exigirá uma estratégia compartilhada antes de habilitá-la.

## Restrições de schema confirmadas

- `storageKey`: máximo de 512 caracteres;
- `mimeType`: máximo de 100 caracteres;
- `originalName`: máximo de 255 caracteres;
- `checksum`: SHA-256 obrigatório;
- `StorageStatus`, `StorageContextType` e `StorageProvider` são enums nativos do
  Prisma/PostgreSQL.

Não há índice único por contexto. O lock atual existe apenas no processo e
serializa substituições na instância única prevista para esta etapa. Ele não
garante unicidade entre réplicas; coordenação compartilhada só será necessária
se a implantação passar a usar múltiplas instâncias.

## Backlog

- estratégia operacional da rotina futura de limpeza de registros `FAILED`,
  linhas concluídas antigas e objetos órfãos;
- coordenação compartilhada caso a aplicação passe a executar em múltiplas
  instâncias;
- decodificação completa dos pixels, caso uma funcionalidade futura processe ou
  transforme imagens.
