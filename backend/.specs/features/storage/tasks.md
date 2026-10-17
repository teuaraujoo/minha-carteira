# Tarefas — módulo de storage

## Ordem de execução

Esta é a primeira spec de funcionalidade a executar na próxima etapa. A
extração da integração R2 é o primeiro trabalho desta spec; as tarefas de
domínio, persistência e integração completam a migração sem antecipar o recurso
ao MVP financeiro.

### STR-00 — Extrair client e serviço do Cloudflare R2

**Depende de:** revisão dos consumidores atuais e da configuração de R2.

- identificar as responsabilidades misturadas em
  `shared/infrastructure/integrations/aws/s3.service.ts`;
- mover a configuração do client e as operações de storage para componentes
  separados em `storage/infrastructure/providers`;
- mover `shared/application/storage/utils/storage.utils.ts` para o módulo de
  storage e atualizar seus consumidores;
- adotar nomenclatura R2 nos componentes próprios da aplicação, mantendo
  `S3Client` e comandos `S3` apenas como nomes do SDK compatível;
- preservar o comportamento usado hoje por `users` enquanto contratos,
  composição e consumidores são migrados nas tarefas seguintes;
- registrar e eliminar imports antigos e qualquer encaminhamento temporário
  até a conclusão de STR-05.

**Testes:** configuração do client, upload e URL assinada com SDK simulado;
verificação de imports e regressão do fluxo atual de foto de perfil.

**Gate:** responsabilidades separadas, sem mudança de provider e sem quebra do
comportamento existente. A remoção completa do caminho compartilhado é
verificada novamente em STR-05.

**Commit sugerido:** `refactor(storage): move r2 integration into storage module`

### STR-01 — Definir domínio e contratos

**Depende de:** STR-00 e entidade `User`.

- criar entidade `StoredFile` e enums confirmados;
- definir invariantes e transições aprovadas;
- criar `StorageGateway`, `StoredFileRepository` e `FileStorageProvider`;
- impedir dependências de Multer, Prisma ou R2 na aplicação.

**Testes:** criação, estados, propriedade e validações da entidade.

**Gate:** domínio compila sem dependências de infraestrutura.

**Commit sugerido:** `feat(storage): define storage domain contracts`

### STR-02 — Preparar persistência Prisma

**Depende de:** STR-01 e aprovação do schema.

- adicionar enums e modelo `StoredFile` ao schema;
- criar relação com `User`;
- adicionar índices de storage, proprietário e status;
- preparar migration `create-storage` após `create-users`;
- revisar os índices de storage, proprietário e status, sem índice por contexto.

**Testes:** integração do repository e constraints no PostgreSQL de teste.

**Gate:** migration revisada; não executada em produção.

**Commit sugerido:** `feat(storage): add prisma persistence`

### STR-03 — Implementar adapter do Cloudflare R2

**Depende de:** STR-00, STR-01 e credenciais configuradas fora do repositório.

- adaptar o serviço R2 extraído à porta `FileStorageProvider` aprovada;
- implementar upload e, conforme a política aprovada, exclusão;
- gerar chave opaca e não previsível;
- mapear falhas sem vazar detalhes internos;
- manter logs em português e sem conteúdo sensível.

**Testes:** adapter com client simulado e cenários de falha.

**Gate:** nenhuma credencial ou URL assinada aparece em logs ou fixtures.

**Commit sugerido:** `feat(storage): add cloudflare r2 adapter`

### STR-04 — Implementar armazenamento por contexto

**Depende de:** STR-02 e STR-03.

- implementar `StorageGateway.replaceForContext` sem conhecer o fluxo de perfil;
- receber `ownerUserId`, `contextType` e `contextId` do caso de uso consumidor;
- validar somente arquivo, contexto presente e invariantes de armazenamento;
- validar presença, tamanho, MIME declarado, assinatura binária e decodificação;
- calcular SHA-256 após a validação do conteúdo;
- remover o registro e o objeto da imagem anterior do mesmo contexto;
- criar e persistir a nova imagem somente após a remoção anterior;
- aplicar a estratégia aprovada para compensação de falhas.

**Testes:** sucesso, ausência de imagem anterior, remoção do registro e objeto
anterior, falha de storage, falha de banco e substituição concorrente; não
simular repository de usuários.

**Gate:** a imagem anterior é removida antes da nova ser persistida, existe no
máximo um arquivo por contexto e `storage` não consulta `users` nem interpreta
status ou autorização do proprietário.

**Commit sugerido:** `feat(storage): implement contextual file storage`

### STR-05 — Integrar módulos consumidores

**Depende de:** STR-04.

- integrar os casos de uso consumidores ao `StorageGateway`;
- retirar de `users` o consumo direto de `IStorageProvider` e do gerador de
  chaves em `shared`; atualizar a composição das dependências;
- manter Multer e os limites de arquivo na apresentação do módulo consumidor;
- verificar usuário ativo e propriedade em `users` antes da chamada;
- derivar contexto e propriedade no caso de uso consumidor, sem aceitar esses
  identificadores do cliente;
- impedir controller, rota ou schema HTTP dentro de `storage`;
- mapear erros na camada `presentation` do módulo consumidor;
- remover o arquivo antigo `aws/s3.service.ts`, a interface compartilhada de
  storage e eventuais encaminhamentos temporários após migrar todos os imports;
  não manter duas implementações R2 ativas.

**Testes:** arquivo ausente, MIME inválido, tamanho inválido, usuário inativo,
tentativa de IDOR e sucesso no fluxo de `users`.

**Gate:** tipos do Multer não atravessam para `storage`, domínio ou repository;
nenhum consumidor importa infraestrutura de R2 ou storage de `shared`.

**Commit sugerido:** `feat(storage): integrate storage consumers`

## Matriz de cobertura

| Requisito | Tarefas | Evidência esperada |
| --- | --- | --- |
| STR-RF-001, STR-RF-002 | STR-01 a STR-03 | unidade e integração |
| STR-RF-003, STR-RF-005 | STR-04 e STR-05 | aplicação e concorrência |
| STR-RF-004 | STR-01 e STR-04 | domínio |
| STR-RF-006 | STR-01 e STR-04 | contratos entre módulos |
| STR-RF-007 | STR-00, STR-03 e STR-05 | client, serviço e imports |
| STR-RF-008 | STR-01, STR-03 e STR-05 | validação e segurança do arquivo |

## Bloqueios antes da implementação

Não há bloqueios de schema pendentes para esta spec. A implementação deve usar
os limites e enums confirmados no design e calcular o checksum com SHA-256.
