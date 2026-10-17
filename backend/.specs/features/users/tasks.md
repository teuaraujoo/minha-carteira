# Tarefas — módulo de usuários

## Ordem de execução

### USR-00 — Preparar contratos compartilhados

**Depende de:** nenhuma.

- definir `PasswordHasher` na aplicação compartilhada;
- implementar o adapter bcrypt na infraestrutura compartilhada;
- substituir no serviço existente a dependência de `AppError` da apresentação
  por erro de domínio ou aplicação;
- manter o mapeamento para HTTP exclusivamente na borda.

**Testes:** hash, comparação e mapeamento de erro da aplicação.

**Gate:** aplicação não importa arquivos de `shared/presentation`.

**Commit sugerido:** `refactor(shared): define application security contracts`

### USR-01 — Alinhar entidade e tipos de domínio

**Depende de:** USR-00.

- corrigir `inactivetedAt` para `inactivatedAt`;
- incluir `id` no estado efetivamente preservado pela entidade;
- tornar `inactivatedAt` anulável;
- tipar `role` com `UserRoles` e manter capabilities como enum;
- garantir role `USER` na criação pública;
- tipar e testar os comportamentos do ciclo de vida;
- evitar dependência direta de relógio global nos testes.

**Testes:** testes unitários da entidade.

**Gate:** TypeScript sem erros e testes da entidade aprovados.

**Commit sugerido:** `refactor(users): align user domain entity`

### USR-02 — Redesenhar o repository

**Depende de:** USR-01.

- substituir `Promise<any>` por entidades e resultados explícitos;
- remover métodos sem parâmetros e corrigir `cpdateUser`;
- manter somente operações de persistência;
- definir paginação de usuários inativos;
- atualizar doubles e consumidores existentes.

**Testes:** contract tests ou doubles tipados do repository.

**Gate:** busca por `Promise<any>` no contrato sem resultados.

**Commit sugerido:** `refactor(users): type repository contract`

### USR-03 — Implementar cadastro público

**Depende de:** USR-00, USR-01 e USR-02.

- criar DTOs, mapper e caso de uso;
- remover o `trim` da senha no schema HTTP;
- validar unicidade de e-mail e nome de usuário;
- aplicar a unicidade sem diferenciar maiúsculas e minúsculas;
- permitir que usuários diferentes compartilhem o mesmo telefone;
- usar `PasswordHasher`, `IdGenerator` e `ClockProvider`;
- criar usuário ativo sem aceitar campos internos do cliente;
- rejeitar `role` e `capabilities` enviados pelo cliente;
- retornar o envelope de sucesso sem `passwordHash`.

**Testes:** sucesso, campos inválidos, duplicidade e hash obrigatório.

**Gate:** testes unitários e de apresentação do cadastro aprovados.

**Commit sugerido:** `feat(users): implement public registration`

### USR-04 — Implementar perfil autenticado

**Depende de:** USR-02 e middleware de autenticação disponível.

- criar consulta e atualização do próprio perfil;
- obter `userId` somente de `request.auth`;
- rejeitar campos internos;
- mapear respostas seguras.

**Testes:** sucesso, usuário inexistente/inativo e tentativa de IDOR.

**Gate:** nenhum endpoint próprio aceita `userId` controlado pelo cliente.

**Commit sugerido:** `feat(users): add authenticated profile flows`

### USR-05 — Integrar upload ao contexto autenticado

**Depende de:** USR-04 e `ImagesGateway` entregue por IMG-04.

- remover `userId` do schema controlado pelo cliente;
- combinar arquivo do Multer com o contexto autenticado no controller;
- preservar validações de MIME, tamanho e conteúdo;
- chamar `ImagesGateway` com contexto e propriedade derivados do usuário
  autenticado;
- não acessar diretamente o repository de imagens ou o Cloudflare R2;
- não aceitar `contextId` ou `ownerUserId` do cliente;
- manter logs em português e sem dados sensíveis.

**Testes:** arquivo ausente, tipo inválido, tamanho inválido, usuário inativo e
sucesso.

**Gate:** teste prova que outro `userId` não pode ser escolhido pelo cliente.

**Commit sugerido:** `fix(users): secure profile image ownership`

### USR-06 — Implementar ciclo de vida

**Depende de:** USR-01, USR-02 e `RefreshTokensGateway` entregue por AUTH-03.

- implementar desativação e reativação como casos de uso;
- revogar sessões ao desativar;
- registrar datas corretamente;
- definir o chamador autorizado da reativação antes de expor rota.

**Testes:** idempotência, transições válidas e revogação de sessões.

**Gate:** usuário inativo não mantém sessão utilizável.

**Commit sugerido:** `feat(users): implement user lifecycle`

### USR-07 — Implementar limpeza de inativos

**Depende de:** USR-06 e aprovação do mecanismo de agendamento.

- consultar usuários inativos além da data de corte;
- processar em lotes;
- coordenar dependências por contratos públicos;
- remover em cascata sessões, resets e imagens;
- impedir exclusão enquanto houver identidade de mensageria vinculada;
- aplicar a política aprovada aos dados financeiros que não usam cascata;
- excluir de forma transacional;
- registrar contagens sem dados pessoais.

**Testes:** data limite, paginação, falha parcial e usuário reativado.

**Gate:** nenhum usuário com 30 dias ou menos de inatividade é excluído.

**Commit sugerido:** `feat(users): purge expired inactive users`

### USR-08 — Implementar persistência Prisma

**Depende de:** USR-01 e USR-02; alteração de schema exige aprovação.

- mapear entidade e registro de banco;
- normalizar e-mail e nome de usuário para letras minúsculas;
- adicionar constraints únicas para os valores normalizados;
- adicionar constraints `CHECK` para rejeitar e-mail ou username não
  normalizados;
- não adicionar constraint única para telefone;
- mapear `status`, capabilities e timestamps;
- mapear `role` e atribuir `USER` por padrão;
- preparar a migration `create-users`, sem executá-la em produção;
- deixar o modelo `Image` para a migration própria do módulo `images`.

**Testes:** integração do repository contra PostgreSQL de teste.

**Gate:** migration revisada e repository passa os cenários de integração.

**Commit sugerido:** `feat(users): add prisma persistence`

### USR-09 — Expor contratos públicos

**Depende de:** USR-02 e USR-03.

- implementar `UsersAuthGateway`;
- implementar `UsersImagesGateway` para confirmar usuário existente e ativo;
- expor o caso de uso de cadastro para o controller público de `auth`;
- fornecer credenciais somente ao módulo `auth`;
- permitir busca ativa por ID e troca de hash;
- impedir acesso direto ao repository por outro módulo.

**Testes:** adapters públicos, usuário ativo e ausência de hash em saídas HTTP.

**Gate:** `auth` e `images` compilam usando apenas contratos públicos.

**Commit sugerido:** `feat(users): expose public module gateways`

### USR-10 — Atualizar documentação após implementação

**Depende de:** USR-03 a USR-09.

- reconciliar o novo cadastro com a documentação geral;
- documentar rotas realmente implementadas;
- registrar decisões pendentes resolvidas;
- não marcar como funcional o que não foi validado.

**Testes:** revisão manual de links, nomes e exemplos.

**Gate:** documentação e código descrevem o mesmo comportamento.

**Commit sugerido:** `docs(users): document user module behavior`

## Matriz de cobertura

| Requisito | Tarefas | Evidência esperada |
| --- | --- | --- |
| USR-RF-001, USR-RF-002 | USR-00 a USR-03, USR-08 | unidade e integração |
| USR-RF-003, USR-RF-004 | USR-04 | testes HTTP e de aplicação |
| USR-RF-005, USR-RF-006 | USR-06, USR-07 | domínio e integração |
| USR-RF-007 | USR-05 | controller e caso de uso |
| USR-RF-008 | USR-01, USR-09 | domínio e gateway público |
| USR-RF-009 | USR-03, USR-04, USR-09 | presenters e HTTP |

## Comandos de verificação

Os scripts disponíveis no `package.json` devem ser conferidos no momento da
execução. Atualmente não existem scripts `test`, `lint` ou `typecheck`. Sem
alterar scripts, os comandos conhecidos são:

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test test/users/**/*.test.ts
```

O segundo comando deve ser ajustado aos arquivos realmente criados, pois o
comportamento de glob pode variar no PowerShell.

## Bloqueios antes das tarefas afetadas

- aprovar a regra final de formato de `phone` antes de fechar USR-03;
- definir a regra de `@` no username antes de USR-08;
- aprovar campos editáveis antes de fechar USR-04;
- decidir o fluxo autorizado de reativação antes de expor sua rota;
- criar e revisar a migration antes de USR-08;
- escolher o mecanismo de agendamento antes de USR-07;
- definir retenção e recuperação dos dados financeiros antes de USR-07, pois a
  operação é destrutiva.
