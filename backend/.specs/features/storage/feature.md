# Módulo de storage

## Objetivo

Centralizar o ciclo de vida de arquivos usados pela aplicação, começando pela
foto de perfil. O módulo `storage` deve armazenar os metadados dos arquivos,
integrar com o Cloudflare R2 e oferecer contratos públicos aos módulos que
precisam associar uma imagem a um contexto.

## Situação atual e migração necessária

O código inicial reunia a configuração do client compatível com S3 e as
operações do Cloudflare R2 em `shared`. A implementação em andamento já criou
um módulo `storage` com client, adapter R2, repository, serviço de aplicação,
validação e chave opaca. `users` começou a consumir `StorageOperations`; ainda
faltam testes, composição da aplicação, remoção de todos os resquícios legados
e validações completas desta spec.

Os componentes próprios do projeto usam nomenclatura R2. O SDK pode continuar
expondo tipos e comandos com nome `S3`, pois essa é a API compatível usada para
acessar o R2. Não se trata de trocar o provider nem de adicionar AWS S3.

## Resultado esperado

- receber arquivos já extraídos da requisição HTTP;
- validar tipo, tamanho e conteúdo permitido;
- enviar o objeto ao Cloudflare R2;
- persistir uma entidade `StoredFile` genérica;
- acompanhar upload, processamento, conclusão e falha;
- armazenar imagens para um contexto e proprietário informados por um módulo
  consumidor, sem receber IDs controlados pelo cliente;
- permitir novos contextos sem acoplar outros módulos ao repository de arquivos.

## Escopo

### Incluído nesta entrega

- entidade `StoredFile` e enums relacionados;
- adapter de armazenamento para Cloudflare R2;
- extração do client e do serviço R2 hoje reunidos no arquivo compartilhado;
- repository de arquivos armazenados;
- utilitários de storage, incluindo geração de chaves de objetos;
- contrato público consumido por `users`;
- contexto `USER_PROFILE`;
- armazenamento e substituição genérica de imagem por contexto, inicialmente
  consumidos pelo fluxo de foto de perfil de `users`;
- validação de arquivo e proteção das operações internas de armazenamento;
- consumo exclusivo por casos de uso de outros módulos;
- testes unitários e de integração proporcionais ao módulo.

### Reservado para evoluções futuras

- `GROUP_COVER`;
- `TRANSACTION_ATTACHMENT`;
- `RECEIPT`;
- transformação avançada, redimensionamento ou otimização automática;
- CDN ou variantes derivadas;
- limpeza automática de objetos órfãos.

Os valores reservados podem existir no enum, mas não representam funcionalidades
implementadas.

## Limites do módulo

`storage` é dono da entidade `StoredFile`, dos estados, do repository e da integração
com o R2. `users` é dono da decisão de usar uma imagem como foto de perfil, da
consulta de existência e status do usuário e da validação de propriedade. Após
essas verificações, fornece os dados necessários ao contrato público de
`storage`.

O módulo `storage` não expõe rotas HTTP. A camada `presentation` do módulo
consumidor recebe o arquivo, e seu caso de uso chama `storage` com o contexto
definido internamente. O frontend não envia `contextType`, `contextId` nem
`ownerUserId`.

`users` não pode acessar `StoredFileRepository`, o SDK do R2 nem seus adapters.
`storage` não consulta `IUsersRepository` nem usa um gateway de `users` para
decidir se o usuário existe, está ativo ou pode alterar o contexto. Ele valida
somente os invariantes da imagem e do armazenamento. Os identificadores e o
contexto são fornecidos por um caso de uso interno do módulo consumidor, nunca
diretamente pelo frontend.

## Requisitos funcionais

### STR-RF-001 — Upload

O sistema DEVE receber uma imagem validada pela borda HTTP e enviá-la ao
Cloudflare R2 sem usar o nome original como chave do objeto.

### STR-RF-002 — Persistência

O sistema DEVE persistir a imagem com proprietário, contexto, provider, chave,
tipo MIME, tamanho, checksum obrigatório, status e datas de ciclo de vida.

### STR-RF-003 — Contexto de armazenamento

No fluxo de `USER_PROFILE`, `users` DEVE verificar o usuário ativo e passar
`ownerUserId` e `contextId` iguais ao ID autenticado. Esses identificadores
não podem ser escolhidos pelo cliente. `storage` apenas persiste os valores
fornecidos pelo caso de uso consumidor; não conhece a regra de autenticação.

ex: uma coisa que o modulo de image pode fazer é compara se o id recebido é igual ao id do contexto persistido em algum caso de uso que precise atualizar algum registro;

### STR-RF-004 — Estados

O sistema DEVE representar o ciclo de vida com `PROCESSING`, `UPLOADING`,
`COMPLETED` e `FAILED`, seguindo as transições `PROCESSING -> UPLOADING ->
COMPLETED`, `PROCESSING -> FAILED` ou `UPLOADING -> FAILED`. Registros que
falharem permanecem como `FAILED` até a limpeza posterior. Se o registro inicial
não puder ser persistido, não há linha para marcar como `FAILED`.

### STR-RF-005 — Substituição

Ao solicitar a substituição de uma imagem para um contexto, o módulo consumidor
DEVE indicar o contexto aprovado. `storage` DEVE manter a imagem atual ativa
enquanto registra e envia a nova. Se o envio ou a persistência da nova imagem
falhar, a tentativa nova DEVE ser marcada como `FAILED`, a imagem atual DEVE
permanecer ativa e o erro DEVE ser devolvido ao consumidor para informar o
usuário. A marcação depende de o registro ter sido criado e o banco estar
disponível para persistir a falha. Depois que a nova imagem estiver persistida
como `COMPLETED`, `storage`
DEVE remover a imagem anterior. Essa é uma substituição total, não
um versionamento. Falhas na limpeza da imagem anterior não podem transformar
uma substituição já concluída em erro para o usuário; os resíduos ficam para
limpeza posterior.

### STR-RF-006 — Contrato público

O módulo DEVE expor uma porta de aplicação para associação de imagens. Outros
módulos não podem acessar seu repository diretamente.

### STR-RF-007 — Propriedade da integração R2

O módulo `storage` DEVE ser dono da configuração do client R2 e do serviço que
executa operações no bucket. Código de negócio dos módulos consumidores DEVE
acessar somente o contrato público de `storage`, sem importar a infraestrutura
de storage ou o SDK.

### STR-RF-008 — Validação do conteúdo

O sistema DEVE validar o arquivo em camadas: presença e tamanho, MIME declarado,
tipo real identificado pelos bytes e estrutura básica do contêiner. No fluxo
inicial de foto de perfil, os formatos aceitos são PNG, JPEG e WebP. PDF
permanece reservado para um fluxo futuro com validação específica. A decodificação
completa dos pixels não é requisito nesta entrega, pois processamento,
redimensionamento e transformação de imagens estão fora do escopo.

O sistema DEVE calcular o SHA-256 somente depois que o conteúdo for validado.
Arquivos com MIME declarado incompatível com o tipo detectado ou estrutura
básica inválida DEVEM ser rejeitados antes do upload para o R2. A validação não
garante que todos os pixels possam ser decodificados; isso fica para uma etapa
futura caso o sistema passe a processar ou transformar imagens.

## Critérios de aceitação

- [ ] O único provider persistido nesta fase é `CLOUDFLARE_R2`.
- [ ] `StorageStatus` contém exatamente `PROCESSING`, `UPLOADING`, `COMPLETED` e
  `FAILED`.
- [ ] O upload de perfil deriva os IDs do contexto autenticado.
- [ ] `users` verifica existência, status ativo e propriedade antes de chamar
  `storage`; `storage` não consulta o módulo de usuários.
- [ ] O cliente não consegue associar uma imagem a outro usuário.
- [ ] O nome original não é usado como chave pública do objeto.
- [ ] Existe unicidade para `storageProvider + storageKey`.
- [ ] A imagem anterior permanece ativa enquanto a nova tentativa é enviada.
- [ ] Uma falha ao enviar ou persistir a nova imagem marca a tentativa como
  `FAILED` quando o registro existe e o banco aceita a atualização, preserva a
  imagem anterior e retorna erro ao consumidor.
- [ ] A imagem anterior só é removida depois que a nova imagem estiver
  `COMPLETED`.
- [ ] A consulta do arquivo ativo prioriza o registro `COMPLETED` mais recente.
- [ ] Requisições simultâneas para o mesmo contexto são serializadas dentro de
  uma instância do processo; múltiplas instâncias não fazem parte desta etapa.
- [ ] Falhas não deixam o registro marcado como concluído.
- [ ] Quando necessário, a resposta contém URL pré-assinada com expiração de
  30 minutos.
- [ ] Logs estão em português e não expõem conteúdo do arquivo ou dados
  pessoais.
- [ ] `users` utiliza somente o contrato público de `storage`.
- [ ] Client e serviço R2 possuem responsabilidades separadas e residem em
  `storage/infrastructure`, sem implementação R2 remanescente em `shared`.
- [ ] Referências internas a AWS S3 como nome do provider ou do serviço foram
  substituídas por R2; nomes próprios do SDK compatível podem permanecer.
- [ ] A migração dos consumidores e testes não deixa imports quebrados nem
  implementações duplicadas de upload.

## Dependências

- Cloudflare R2;
- `IdGenerator` e `ClockProvider`;
- Prisma e PostgreSQL;
- caso de uso consumidor que valida o contexto antes de chamar `storage`;
- `AppLogger` com mensagens em português;
- Multer apenas na camada de apresentação do módulo consumidor.

## Decisões confirmadas

- existe um módulo próprio para storage;
- `users` se conecta a esse módulo por contrato público;
- existência, status e autorização do usuário são regras de `users`, não de
  `storage`; não há `UsersStorageGateway`;
- a entidade `StoredFile` é genérica e vinculada por contexto;
- nesta entrega, somente `USER_PROFILE` é funcional;
- `StorageProvider` possui somente `CLOUDFLARE_R2`;
- `StorageStatus` possui `PROCESSING`, `UPLOADING`, `COMPLETED` e `FAILED`;
- `ownerUserId` referencia o usuário que enviou a imagem;
- a exclusão definitiva do usuário remove suas imagens em cascata;
- `storage` não possui camada `presentation` nem rota HTTP própria;
- client e serviço específicos do Cloudflare R2 pertencem ao módulo `storage`;
- a troca de imagem é uma substituição total: a imagem anterior permanece ativa
  até a nova ser persistida como `COMPLETED`; uma falha da tentativa nova a
  marca como `FAILED` e preserva a anterior;
- a URL retornada é pré-assinada e expira em 30 minutos;
- falhas mantêm o registro como `FAILED`, com limpeza posterior e rotina futura
  para remoção definitiva;
- a spec de `storage` será executada antes das specs dependentes de upload de
  imagem de perfil;
- os registros podem ser criados em migration própria após usuários.
- Imagens com tamanho máximo de 10 MiB.
- Tipos MIME aceitos no fluxo de perfil: `image/png`, `image/jpeg` e
  `image/webp`; PDF permanece reservado para fluxo futuro com validação própria.
- Uso obrigatório de checksum SHA-256.
- `storageKey` possui limite de 512 caracteres;
- `mimeType` possui limite de 100 caracteres;
- `originalName` possui limite de 255 caracteres;
- enums são persistidos como enums nativos do Prisma/PostgreSQL;
- checksum utiliza SHA-256;
-  a validação do conteúdo real ocorre antes do upload; o fluxo de perfil aceita
  PNG, JPEG e WebP, e PDF fica reservado para validação futura;
- decodificação completa, processamento e redimensionamento de imagem não fazem
  parte do escopo atual; a validação confere assinatura e estrutura básica;
- tratamento de falha entre envio do objeto e persistência no banco: a imagem
  começa em `PROCESSING`, passa para `UPLOADING`, fica `FAILED` em caso de
  falha e chega a `COMPLETED` em caso de sucesso.

## Backlog

- estratégia operacional da rotina futura de limpeza de registros `FAILED`,
  linhas concluídas antigas e objetos órfãos.
- decodificação completa dos pixels, caso uma funcionalidade futura processe ou
  transforme imagens.

## Bloqueios de implementação

- A integração final de perfil depende do middleware e da composição de `users`.

## Validações adiadas

- validar migrations e repository em PostgreSQL após configurar `DATABASE_URL`;
- adotar coordenação compartilhada se houver mais de uma instância da API.
