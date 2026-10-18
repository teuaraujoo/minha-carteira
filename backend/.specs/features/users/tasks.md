# Tarefas — módulo de usuários

## Execution Plan

As fases são executadas sequencialmente. As tarefas de cada fase também são
executadas na ordem indicada. Dependências de módulos externos permanecem
explícitas e não autorizam implementar decisões de produto ainda pendentes.

### Fase 1 — Fundação de usuários

```text
T1 → T2 → T3
```

### Fase 2 — Cadastro e contratos públicos

```text
T1 → T4
T2 → T4
T3 → T4 → T6
T2 → T5
T3 → T5
T3 → T6
T4 → T6
```

`T5` (persistência Prisma) não autoriza configurar a URL do banco nem executar
migrations. A migration fica preparada em código para validação posterior,
quando a configuração do PostgreSQL estiver disponível.

### Fase 3 — Funcionalidades autenticadas de usuários

```text
T3 → T7 → T8
T2 → T9
T3 → T9
T9 → T10
T9 → T11
```

O middleware de `auth` e o gateway de revogação de sessões já existem. `T9`
permanece pendente somente até definir quem pode solicitar a reativação de um
usuário; as decisões de agendamento e retenção financeira pertencem a T10.

### Fase 4 — Documentação

```text
T4 → T11
T5 → T11
T6 → T11
T7 → T11
T8 → T11
T10 → T11
```

## Task Breakdown

### T1: [USR-00] Preparar contratos compartilhados

**Status:** Concluída; suíte focada aprovada. A referência a duas falhas antigas
era histórica e foi removida.
**What:** Definir `PasswordHasher`, adapter bcrypt e reutilizar o `AppError`
global nos serviços, sem criar classes de erro específicas por módulo.
**Where:** contratos e infraestrutura compartilhados e serviços de aplicação.
**Depends on:** Nenhuma.
**Requirement:** USR-RF-001.

**Done when:**

- [x] Hash e comparação de senha são cobertos por testes.
- [x] Serviços reutilizam o `AppError` global; não existem classes de erro
      específicas para users/auth/storage.
- [x] A apresentação centraliza a serialização do erro global em HTTP.

**Tests:** unit
**Gate:** quick
**Gate command:** `node --import tsx --test test/shared/bcrypt-password-hasher.test.ts test/users/profile-image-upload.test.ts test/logging/users-service-logging.test.ts`
**Commit:** `refactor(shared): define application security contracts`

### T2: [USR-01] Alinhar entidade e tipos de domínio

**Status:** Concluída; suíte users/storage atual passou (51/51) e TypeScript
passou em 18/10/2026. A referência a falhas antigas era histórica.
**What:** Corrigir a entidade `User`, seus enums e comportamentos de domínio.
**Where:** entidade, enums e testes de domínio de `users`.
**Depends on:** T1.
**Requirement:** USR-RF-005, USR-RF-008.

**Done when:**

- [x] `inactivatedAt` substitui a grafia incorreta e aceita `null`.
- [x] O estado preserva `id`, `role`, capabilities e timestamps tipados.
- [x] Cadastro de domínio atribui `USER`; ciclo de vida e capabilities são
      testados com relógio determinístico.
- [x] A verificação TypeScript e os testes da entidade passam.

**Tests:** unit
**Gate:** quick
**Gate command:** `node --import tsx --test test/users/user.entity.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`
**Commit:** `refactor(users): align user domain entity`

### T3: [USR-02] Tipar o contrato do repository

**Status:** Concluída; suíte users/storage atual passou (51/51) e TypeScript
passou em 18/10/2026. A referência a falhas antigas era histórica.
**What:** Substituir respostas `any` e restringir o repository a operações de
persistência.
**Where:** contrato do repository, doubles e consumidores diretamente afetados.
**Depends on:** T2.
**Requirement:** USR-RF-001, USR-RF-005.

**Done when:**

- [x] O contrato não contém `Promise<any>`, métodos sem parâmetros ou
      `cpdateUser`.
- [x] Operações de persistência retornam entidades/resultados explícitos.
- [x] A consulta paginada de inativos possui entrada e saída tipadas.
- [x] Testes de contrato ou doubles tipados passam.

**Tests:** unit
**Gate:** quick
**Gate command:** `node --import tsx --test test/users/users-repository.contract.test.ts test/users/profile-image-upload.test.ts test/logging/users-service-logging.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`
**Commit:** `refactor(users): type repository contract`

### T4: [USR-03] Implementar cadastro público

**Status:** Concluída; gate quick e verificação TypeScript aprovados.
**What:** Criar DTOs, mapper e caso de uso para cadastro seguro de usuário.
**Where:** aplicação e apresentação de `users`, incluindo testes.
**Depends on:** T1, T2, T3.
**Requirement:** USR-RF-001, USR-RF-002, USR-RF-008, USR-RF-009.

**Done when:**

- [x] O schema não aplica `trim` à senha e rejeita `role` e `capabilities`
      enviados pelo cliente.
- [x] O caso de uso normaliza e verifica unicidade de e-mail e username,
      protege-se contra duplicidade na persistência e permite telefone
      compartilhado.
- [x] O cadastro usa `PasswordHasher`, `IdGenerator` e `ClockProvider`, cria
      usuário ativo com role `USER` e não devolve `passwordHash`.
- [x] Testes cobrem sucesso, entrada inválida, duplicidade e hash obrigatório.

**Tests:** unit
**Gate:** quick
**Gate command:** `node --import tsx --test test/users/register-user.use-case.test.ts test/users/create-user.schema.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`
**Commit:** `feat(users): implement public registration`

### T5: [USR-08] Implementar persistência Prisma

**Status:** Concluída; gate focado, suíte ampla de users e verificação TypeScript aprovados. Integração PostgreSQL adiada até configurar a URL do banco.
**What:** Mapear entidade e repository de usuários para o modelo Prisma e
preparar a migration.
**Where:** schema/modelo Prisma, repository e testes de persistência de `users`.
**Depends on:** T2, T3.
**Requirement:** USR-RF-001, USR-RF-002, USR-RF-005, USR-RF-008.

**Done when:**

- [x] E-mail e username são normalizados, possuem unicidade e checks para
      impedir persistência não normalizada.
- [x] Telefone não é único; status, role, capabilities e timestamps são
      mapeados.
- [x] A migration `create-users` está revisada em código e precede a migration
      de `storage`.
- [x] Testes de repository são preparados sem exigir conexão real enquanto a
      URL do PostgreSQL não estiver configurada.
- [x] Nenhuma migration é executada nesta tarefa.

**Tests:** unit para mapeamento e comportamento do repository usando Prisma fake; integração real com PostgreSQL adiada até a configuração da URL do banco.
**Gate:** full
**Gate command:** `node --import tsx --test test/users/prisma-users.repository.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`; suíte ampla validada com `node --import tsx --test test/users/*.test.ts`
**Commit:** `feat(users): add prisma persistence`

### T6: [USR-09] Expor contratos públicos para auth

**Status:** Concluída; gate focado, suíte ampla de users, verificação TypeScript e busca de imports diretos aprovados.
**What:** Implementar `UsersAuthGateway` e expor o caso de uso de cadastro sem
expor o repository de `users`.
**Where:** contratos públicos e adapters de `users`, com testes.
**Depends on:** T3, T4.
**Requirement:** USR-RF-008, USR-RF-009.

**Done when:**

- [x] `auth` consegue buscar credenciais por identificador, buscar usuário
      ativo por ID e trocar hash usando apenas o gateway público.
- [x] Hash nunca aparece em DTO ou saída HTTP.
- [x] Nenhum outro módulo importa diretamente o repository de `users`.
- [x] Testes cobrem adapters e busca de usuário ativo.

**Tests:** unit
**Gate:** quick
**Gate command:** `node --import tsx --test test/users/users-public-gateways.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`; suíte ampla validada com `node --import tsx --test test/users/*.test.ts`; imports revisados com `rg "users/(infrastructure/repositories|.*users\\.repository)|IUsersRepository" src/modules --glob "*.ts"`
**Commit:** `feat(users): expose public module gateways`

### T7: [USR-04] Implementar perfil autenticado

**Status:** Revisão — implementação e testes unitários concluídos; falta teste
integrado do router HTTP.
**What:** Consultar e atualizar o próprio perfil a partir do contexto autenticado.
**Where:** aplicação e apresentação de `users`, incluindo testes.
**Depends on:** T3 e middleware de autenticação da spec `auth`.
**Requirement:** USR-RF-003, USR-RF-004, USR-RF-009.

**Done when:**

- [x] O identificador vem exclusivamente de `request.auth`.
- [x] Campos internos são rejeitados; somente campos editáveis aprovados são
      alterados.
- [x] Respostas seguras cobrem sucesso e usuário inexistente/inativo; a
      identidade não é aceita do cliente, prevenindo IDOR nesse fluxo.
- [x] Os campos autorizados para esta etapa são `name` e `phone`.

**Tests:** unit e e2e
**Gate:** full
**Commit:** `feat(users): add authenticated profile flows`

### T8: [USR-05] Integrar upload ao contexto autenticado

**Status:** Revisão — integração e testes de controller/Multer concluídos; falta
teste integrado do router HTTP.
**What:** Associar upload à identidade autenticada e integrar pelo contrato
público de `storage`.
**Where:** caso de uso e controller de imagem de perfil em `users`, incluindo
testes.
**Depends on:** T7 e `StorageOperations` de STR-04.
**Requirement:** USR-RF-007, USR-RF-009.

**Done when:**

- [x] Cliente não escolhe `userId`, `contextId` ou `ownerUserId`.
- [x] Usuário autenticado é confirmado como existente e ativo antes de chamar
      `storage`.
- [x] Validações de arquivo e logs em português permanecem aplicadas, sem dados
      sensíveis.
- [x] Testes unitários/de controller cobrem arquivo ausente, tipo/tamanho
      inválido, contexto ausente e sucesso associado ao usuário autenticado.
- [ ] Teste HTTP integrado da rota autenticada ainda não existe; não confundir
      isso com a execução bloqueada dos testes HTTP de `auth` neste ambiente.

**Tests:** unit e e2e
**Gate:** full
**Commit:** `fix(users): secure profile image ownership`

### T9: [USR-06] Implementar ciclo de vida do usuário

**Status:** A fazer — auth e gateway de revogação disponíveis; depende da
definição do chamador autorizado para reativação.
**What:** Implementar desativação e reativação como casos de uso.
**Where:** casos de uso de ciclo de vida de `users`, com testes.
**Depends on:** T2, T3 e `RefreshTokensGateway` de auth.
**Requirement:** USR-RF-005.

**Done when:**

- [ ] Desativação registra datas e revoga sessões por contrato público.
- [ ] Reativação só é exposta após definir o chamador autorizado.
- [ ] Testes cobrem idempotência, transições e revogação de sessões.

**Tests:** unit
**Gate:** full
**Commit:** `feat(users): implement user lifecycle`

### T10: [USR-07] Implementar limpeza de inativos

**Status:** A fazer — bloqueada por decisões de produto e agendamento.
**What:** Excluir em lotes usuários inativos elegíveis, coordenando dependências
por contratos públicos.
**Where:** caso de uso interno de limpeza e testes de `users`.
**Depends on:** T9.
**Requirement:** USR-RF-006.

**Done when:**

- [ ] A consulta seleciona somente usuários inativos há mais de 30 dias e
      processa lotes.
- [ ] Exclusão respeita cascatas de sessões, resets e imagens e bloqueia
      identidade de mensageria ainda vinculada.
- [ ] A política para dados financeiros e o mecanismo de agendamento estão
      aprovados antes de implementar exclusão destrutiva.
- [ ] Testes cobrem data limite, paginação, falha parcial e usuário reativado.

**Tests:** integration
**Gate:** full
**Commit:** `feat(users): purge expired inactive users`

### T11: [USR-10] Atualizar documentação após implementação

**Status:** A fazer
**What:** Reconciliar documentação geral com o comportamento efetivamente
implementado.
**Where:** documentação geral e referências de `users` realmente afetadas.
**Depends on:** T4, T5, T6, T7, T8, T9 e T10.
**Requirement:** USR-RF-001 a USR-RF-009.

**Done when:**

- [ ] Rotas, exemplos e decisões documentadas correspondem ao código validado.
- [ ] Pendências não implementadas permanecem identificadas como pendentes.
- [ ] Links e nomes são revisados manualmente.

**Tests:** none
**Gate:** build
**Commit:** `docs(users): document user module behavior`

## Test Coverage Matrix

> Proveniência: `AGENTS.md`, scripts e testes existentes em `backend`. Não há
> scripts `test`, `lint` ou `typecheck` configurados no `package.json`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Domain, services e use cases | unit | Cobrir requisitos e casos de borda da tarefa | `backend/test/users/*.test.ts` | `node --import tsx --test test/users/*.test.ts` |
| Apresentação HTTP | e2e | Cobrir rota feliz, erros documentados e IDOR | `backend/test/users/*.test.ts` | `node --import tsx --test test/users/*.test.ts` |
| Prisma repository | unit e integration | Testes unitários de mapeamento e comportamento sem banco; integração real após configurar PostgreSQL | `backend/test/users/*.test.ts` | `node --import tsx --test test/users/*.test.ts` |
| Entidade, schemas e configuração | unit | Validar regras e transformações documentadas | `backend/test/users/*.test.ts` | `node --import tsx --test test/users/*.test.ts` |

Testes de integração que dependem de PostgreSQL ficam adiados até a configuração
da URL do banco de teste. Até lá, a persistência é verificada por testes sem
banco e por TypeScript.

## Gate Check Commands

> Comandos identificados no projeto. Executar a partir de `backend/`.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Tarefas com testes unitários | `node --import tsx --test test/users/*.test.ts` |
| Full | Tarefas HTTP ou persistência em código | `node --import tsx --test test/users/*.test.ts` e `node node_modules/typescript/bin/tsc --noEmit`; testes PostgreSQL após configurar a URL |
| Build | Fechamento de fase ou tarefa sem testes | `node node_modules/typescript/bin/tsc --noEmit` |

Os scripts disponíveis devem ser conferidos antes da execução. Não há gate de
lint configurado. O glob deve ser ajustado aos arquivos realmente criados e
validado no PowerShell.

## Pending Decisions and Blockers

- `phone` não é único; definir apenas o formato aceito antes de fechar sua
  validação de cadastro.
- Campos editáveis desta etapa já aprovados: `name` e `phone`.
- Definir quem pode reativar usuários antes de expor essa rota em T9.
- Aprovar mecanismo de agendamento, retenção dos dados financeiros e política
  da identidade de mensageria antes da limpeza destrutiva em T10.
- A URL do PostgreSQL será configurada depois; não executar migrations agora.
