# Tarefas — módulo de imagens

## Ordem de execução

Esta é a primeira spec de funcionalidade a executar na próxima etapa. A
extração da integração R2 é o primeiro trabalho desta spec; as tarefas de
domínio, persistência e integração completam a migração sem antecipar o recurso
ao MVP financeiro.

### IMG-00 — Extrair client e serviço do Cloudflare R2

**Depende de:** revisão dos consumidores atuais e da configuração de R2.

- identificar as responsabilidades misturadas em
  `shared/infrastructure/integrations/aws/s3.service.ts`;
- mover a configuração do client e as operações de storage para componentes
  separados em `images/infrastructure/storage`;
- adotar nomenclatura R2 nos componentes próprios da aplicação, mantendo
  `S3Client` e comandos `S3` apenas como nomes do SDK compatível;
- preservar o comportamento usado hoje por `users` enquanto contratos,
  composição e consumidores são migrados nas tarefas seguintes;
- registrar e eliminar imports antigos e qualquer encaminhamento temporário
  até a conclusão de IMG-05.

**Testes:** configuração do client, upload e URL assinada com SDK simulado;
verificação de imports e regressão do fluxo atual de foto de perfil.

**Gate:** responsabilidades separadas, sem mudança de provider e sem quebra do
comportamento existente. A remoção completa do caminho compartilhado é
verificada novamente em IMG-05.

**Commit sugerido:** `refactor(images): move r2 integration into images module`

### IMG-01 — Definir domínio e contratos

**Depende de:** IMG-00, entidade `User` e decisões pendentes de estado.

- criar entidade `Image` e enums confirmados;
- definir invariantes e transições aprovadas;
- criar `ImagesGateway`, `ImagesRepository` e `ImageStorageProvider`;
- impedir dependências de Multer, Prisma ou R2 na aplicação.

**Testes:** criação, estados, propriedade e validações da entidade.

**Gate:** domínio compila sem dependências de infraestrutura.

**Commit sugerido:** `feat(images): define image domain contracts`

### IMG-02 — Preparar persistência Prisma

**Depende de:** IMG-01 e aprovação do schema.

- adicionar enums e modelo `Image` ao schema;
- criar relação com `User`;
- adicionar índices de storage, contexto, proprietário e status;
- preparar migration `create-images` após `create-users`;
- revisar a unicidade da foto de perfil ativa.

**Testes:** integração do repository e constraints no PostgreSQL de teste.

**Gate:** migration revisada; não executada em produção.

**Commit sugerido:** `feat(images): add prisma persistence`

### IMG-03 — Implementar adapter do Cloudflare R2

**Depende de:** IMG-00, IMG-01 e credenciais configuradas fora do repositório.

- adaptar o serviço R2 extraído à porta `ImageStorageProvider` aprovada;
- implementar upload e, conforme a política aprovada, exclusão;
- gerar chave opaca e não previsível;
- mapear falhas sem vazar detalhes internos;
- manter logs em português e sem conteúdo sensível.

**Testes:** adapter com client simulado e cenários de falha.

**Gate:** nenhuma credencial ou URL assinada aparece em logs ou fixtures.

**Commit sugerido:** `feat(images): add cloudflare r2 adapter`

### IMG-04 — Implementar foto de perfil

**Depende de:** IMG-02, IMG-03 e `UsersImagesGateway` entregue por USR-09.

- implementar `replaceUserProfileImage`;
- validar usuário ativo por `UsersImagesGateway`;
- derivar `ownerUserId` e `contextId` do usuário autenticado;
- substituir logicamente a imagem ativa anterior;
- aplicar a estratégia aprovada para compensação de falhas.

**Testes:** sucesso, usuário inativo, IDOR, falha de storage, falha de banco e
substituição concorrente.

**Gate:** existe no máximo uma imagem ativa e nenhum ID vem do cliente.

**Commit sugerido:** `feat(images): implement profile image flow`

### IMG-05 — Integrar módulos consumidores

**Depende de:** IMG-04.

- integrar os casos de uso consumidores ao `ImagesGateway`;
- retirar de `users` o consumo direto de `IStorageProvider` e do gerador de
  chaves em `shared`; atualizar a composição das dependências;
- manter Multer e os limites de arquivo na apresentação do módulo consumidor;
- derivar contexto e propriedade no backend;
- impedir controller, rota ou schema HTTP dentro de `images`;
- mapear erros na camada `presentation` do módulo consumidor.
- remover o arquivo antigo `aws/s3.service.ts`, a interface compartilhada de
  storage e eventuais encaminhamentos temporários após migrar todos os imports;
  não manter duas implementações R2 ativas.

**Testes:** arquivo ausente, MIME inválido, tamanho inválido e sucesso.

**Gate:** tipos do Multer não atravessam para `images`, domínio ou repository;
nenhum consumidor importa infraestrutura de R2 ou storage de `shared`.

**Commit sugerido:** `feat(images): integrate image consumers`

## Matriz de cobertura

| Requisito | Tarefas | Evidência esperada |
| --- | --- | --- |
| IMG-RF-001, IMG-RF-002 | IMG-01 a IMG-03 | unidade e integração |
| IMG-RF-003, IMG-RF-005 | IMG-04 | aplicação e concorrência |
| IMG-RF-004 | IMG-01 e IMG-04 | domínio |
| IMG-RF-006 | IMG-01 e IMG-04 | contratos entre módulos |
| IMG-RF-007 | IMG-00, IMG-03 e IMG-05 | client, serviço e imports |

## Bloqueios antes da implementação

- aprovar transições de estado;
- definir limites de MIME e tamanho;
- definir representação da URL;
- aprovar compensação de falhas entre R2 e PostgreSQL;
- decidir retenção e remoção física dos objetos;
- aprovar o índice que garante uma foto de perfil ativa.
