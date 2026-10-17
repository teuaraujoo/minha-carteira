# Tarefas — módulo de storage

## Como acompanhar o andamento

Cada tarefa contém um campo `Status`, com os valores `Backlog`, `A fazer`,
`Em andamento`, `Revisão` ou `Feito`. Um bloqueio é indicado separadamente por
`blocked: true`, `blockedReason` e `blockedAt`. `Feito` só deve ser usado após
verificação independente dos critérios e criação dos commits necessários.

## Ordem de execução

Esta é a primeira spec de funcionalidade a executar na próxima etapa. A
extração da integração R2 é o primeiro trabalho desta spec; as tarefas de
domínio, persistência e integração completam a migração sem antecipar o recurso
ao MVP financeiro.

### STR-00 — Extrair client e serviço do Cloudflare R2

**Status:** Feito

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

**Status:** Feito

**Depende de:** STR-00 e entidade `User`.

- criar entidade `StoredFile` e enums confirmados;
- definir invariantes e transições aprovadas;
- criar `StorageOperations`, `StoredFileRepository` e `ObjectStorageProvider`;
- impedir dependências de Multer, Prisma ou R2 na aplicação.

**Testes:** criação, estados, propriedade e validações da entidade.

**Gate:** domínio compila sem dependências de infraestrutura.

**Commit sugerido:** `feat(storage): define storage domain contracts`

### STR-02 — Preparar persistência Prisma

**Status:** Em andamento
**blocked:** true
**blockedReason:** A validação das migrations, constraints e repository ainda
depende de um PostgreSQL de teste configurado.
**blockedAt:** 2026-10-17

**Depende de:** STR-01 e aprovação do schema.

- adicionar enums e modelo `StoredFile` ao schema;
- criar relação com `User`;
- adicionar índices de storage, proprietário e status;
- manter `create-storage` após `create-users` na ordem cronológica das pastas;
- revisar os índices de storage, proprietário e status, sem índice por contexto.

**Testes:** integração do repository e constraints no PostgreSQL de teste.

**Gate:** migration revisada; não executada em produção.

**Commit sugerido:** `feat(storage): add prisma persistence`

### STR-03 — Implementar adapter do Cloudflare R2

**Status:** Feito

**Depende de:** STR-00, STR-01 e credenciais configuradas fora do repositório.

- adaptar o serviço R2 extraído à porta interna `ObjectStorageProvider`;
- implementar upload e, conforme a política aprovada, exclusão;
- gerar chave opaca e não previsível;
- mapear falhas sem vazar detalhes internos;
- manter logs em português e sem conteúdo sensível.

**Testes:** adapter com client simulado e cenários de falha.

**Gate:** nenhuma credencial ou URL assinada aparece em logs ou fixtures.

**Commit sugerido:** `feat(storage): add cloudflare r2 adapter`

### STR-04 — Implementar armazenamento por contexto

**Status:** Em andamento
**blocked:** true
**blockedReason:** A coordenação entre processos sem índice único por contexto
precisa de uma estratégia aprovada e validada.
**blockedAt:** 2026-10-17

**Depende de:** STR-02 e STR-03.

- implementar `StorageOperations.replaceFileContent` sem conhecer o fluxo de perfil;
- receber `ownerUserId`, `contextType` e `contextId` do caso de uso consumidor;
- validar somente arquivo, contexto presente e invariantes de armazenamento;
- validar presença, tamanho, MIME declarado, assinatura binária e estrutura
  básica do contêiner; não exigir decodificação completa nesta entrega;
- calcular SHA-256 após a validação do conteúdo;
- manter a imagem anterior ativa até a nova imagem estar `COMPLETED`;
- em falha antes da conclusão, marcar a tentativa nova como `FAILED` quando a
  linha existir e o banco aceitar a atualização, preservar a imagem anterior e
  propagar o erro ao módulo consumidor;
- após a conclusão, remover o objeto e o registro anteriores; falhas de limpeza
  não anulam o sucesso da nova imagem e deixam resíduos para limpeza posterior.

**Testes:** sucesso, ausência de imagem anterior, remoção do registro e objeto
anterior, falha de storage, falha de banco e substituição concorrente; não
simular repository de usuários.

**Gate:** uma falha na nova tentativa preserva a imagem anterior e marca a nova
como `FAILED`; `storage` não consulta `users` nem interpreta status ou
autorização do proprietário. A garantia contra substituições simultâneas entre
processos permanece pendente de coordenação compartilhada.

**Commit sugerido:** `feat(storage): implement contextual file storage`

### STR-05 — Integrar módulos consumidores

**Status:** Em andamento
**blocked:** true
**blockedReason:** O middleware de autenticação que fornece `request.auth` ainda
não foi implementado, e a composição/rota de usuários ainda não existe.
**blockedAt:** 2026-10-17

**Depende de:** STR-04.

- integrar os casos de uso consumidores ao `StorageOperations`;
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

## Bloqueios antes da conclusão

- configurar PostgreSQL de teste para verificar repository e constraints;
- aprovar coordenação entre processos sem índice único por contexto;
- implementar o middleware de autenticação e a composição/rota de `users` que
  fornecem `request.auth`.
