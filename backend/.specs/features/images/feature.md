# Módulo de imagens

## Objetivo

Centralizar o ciclo de vida de imagens usadas pela aplicação, começando pela
foto de perfil. O módulo `images` deve armazenar os metadados dos arquivos,
integrar com o Cloudflare R2 e oferecer contratos públicos aos módulos que
precisam associar uma imagem a um contexto.

Esta é uma especificação pós-MVP. Ela organiza uma entrega própria e não inclui
Cloudflare R2 ou imagens no escopo do MVP financeiro inicial.

Esta será a primeira spec de funcionalidade executada na próxima etapa de
implementação. Essa prioridade não antecipa imagens para o MVP financeiro.

## Situação atual e migração necessária

Hoje, `backend/src/shared/infrastructure/integrations/aws/s3.service.ts`
exporta `R2Client`, mas a mesma classe configura o client do SDK compatível
com S3, faz upload e gera URL assinada. O caminho `aws/s3` sugere um serviço AWS
S3, enquanto o provider usado é Cloudflare R2. `UserService` consome diretamente
`IStorageProvider` do módulo compartilhado e monta a chave da foto de perfil
fora de `images`. Ainda não há integração com um módulo de imagens implementado.

A implementação desta spec deve separar a configuração do client das operações
de storage, nomear os componentes próprios da aplicação como R2 e transferir
ambos para `images/infrastructure`. O SDK pode continuar expondo tipos e
comandos com nome `S3`, pois essa é a API compatível usada para acessar o R2.
Não se trata de trocar o provider nem de adicionar AWS S3.

## Resultado esperado

- receber arquivos já extraídos da requisição HTTP;
- validar tipo, tamanho e conteúdo permitido;
- enviar o objeto ao Cloudflare R2;
- persistir uma entidade `Image` genérica;
- acompanhar upload, processamento, conclusão e falha;
- associar a foto ao usuário autenticado sem aceitar IDs controlados pelo
  cliente;
- permitir novos contextos sem acoplar outros módulos ao repository de imagens.

## Escopo

### Incluído nesta entrega

- entidade `Image` e enums relacionados;
- adapter de armazenamento para Cloudflare R2;
- extração do client e do serviço R2 hoje reunidos no arquivo compartilhado;
- repository de imagens;
- contrato público consumido por `users`;
- contexto `USER_PROFILE`;
- upload e substituição da imagem de perfil;
- validação de propriedade e proteção contra IDOR;
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

`images` é dono da entidade `Image`, dos estados, do repository e da integração
com o R2. `users` é dono da decisão de usar uma imagem como foto de perfil e
fornece o usuário autenticado ao contrato público de `images`.

O módulo `images` não expõe rotas HTTP. A camada `presentation` do módulo
consumidor recebe o arquivo, e seu caso de uso chama `images` com o contexto
definido internamente. O frontend não envia `contextType`, `contextId` nem
`ownerUserId`.

`users` não pode acessar `ImagesRepository`, o SDK do R2 nem seus adapters. O
módulo `images` não pode consultar diretamente `IUsersRepository`; quando
precisar validar o contexto, deve receber um contrato público do módulo dono.

## Requisitos funcionais

### IMG-RF-001 — Upload

O sistema DEVE receber uma imagem validada pela borda HTTP e enviá-la ao
Cloudflare R2 sem usar o nome original como chave do objeto.

### IMG-RF-002 — Persistência

O sistema DEVE persistir a imagem com proprietário, contexto, provider, chave,
tipo MIME, tamanho, checksum opcional, status e datas de ciclo de vida.

### IMG-RF-003 — Foto de perfil

No contexto `USER_PROFILE`, `ownerUserId` e `contextId` DEVEM corresponder ao ID
do usuário autenticado. Esses identificadores não podem ser escolhidos pelo
cliente.

### IMG-RF-004 — Estados

O sistema DEVE representar o ciclo de vida com `UPLOADING`, `PROCESSING`,
`COMPLETED` e `FAILED`. As transições exatas devem ser aprovadas no design antes
da implementação.

### IMG-RF-005 — Substituição

O sistema DEVE manter no máximo uma imagem de perfil ativa por usuário. A
política de exclusão física do objeto anterior permanece pendente e não pode ser
inferida pelo caso de uso.

### IMG-RF-006 — Contrato público

O módulo DEVE expor uma porta de aplicação para associação de imagens. Outros
módulos não podem acessar seu repository diretamente.

### IMG-RF-007 — Propriedade da integração R2

O módulo `images` DEVE ser dono da configuração do client R2 e do serviço que
executa operações no bucket. Código de negócio dos módulos consumidores DEVE
acessar somente o contrato público de `images`, sem importar a infraestrutura
de storage ou o SDK.

## Critérios de aceitação

- [ ] O único provider persistido nesta fase é `CLOUDFLARE_R2`.
- [ ] `ImageStatus` contém exatamente `PROCESSING`, `UPLOADING`, `COMPLETED` e
  `FAILED`.
- [ ] O upload de perfil deriva os IDs do contexto autenticado.
- [ ] O cliente não consegue associar uma imagem a outro usuário.
- [ ] O nome original não é usado como chave pública do objeto.
- [ ] Existe unicidade para `storageProvider + storageKey`.
- [ ] Existe no máximo uma imagem de perfil ativa por usuário.
- [ ] Falhas não deixam o registro marcado como concluído.
- [ ] Logs estão em português e não expõem conteúdo do arquivo ou dados
  pessoais.
- [ ] `users` utiliza somente o contrato público de `images`.
- [ ] Client e serviço R2 possuem responsabilidades separadas e residem em
  `images/infrastructure`, sem implementação R2 remanescente em `shared`.
- [ ] Referências internas a AWS S3 como nome do provider ou do serviço foram
  substituídas por R2; nomes próprios do SDK compatível podem permanecer.
- [ ] A migração dos consumidores e testes não deixa imports quebrados nem
  implementações duplicadas de upload.

## Dependências

- Cloudflare R2;
- `IdGenerator` e `ClockProvider`;
- Prisma e PostgreSQL;
- contrato público de `users` para validar o contexto;
- `AppLogger` com mensagens em português;
- Multer apenas na camada de apresentação do módulo consumidor.

## Decisões confirmadas

- existe um módulo próprio para imagens;
- `users` se conecta a esse módulo por contrato público;
- a entidade é genérica e vinculada por contexto;
- nesta entrega, somente `USER_PROFILE` é funcional;
- `StorageProvider` possui somente `CLOUDFLARE_R2`;
- `ImageStatus` possui `PROCESSING`, `UPLOADING`, `COMPLETED` e `FAILED`;
- `ownerUserId` referencia o usuário que enviou a imagem;
- a exclusão definitiva do usuário remove suas imagens em cascata;
- `images` não possui camada `presentation` nem rota HTTP própria;
- client e serviço específicos do Cloudflare R2 pertencem ao módulo `images`;
- a spec de `images` será executada antes das specs dependentes de upload de
  imagem de perfil;
- os registros podem ser criados em migration própria após usuários.

## Decisões pendentes

- transições autorizadas entre os estados;
- tipos MIME e tamanho máximo;
- uso obrigatório ou opcional de checksum;
- formato e visibilidade da URL retornada;
- política de remoção física e retenção no R2;
- tratamento de falha entre envio do objeto e persistência no banco;
- estratégia de unicidade da imagem de perfil ativa.
