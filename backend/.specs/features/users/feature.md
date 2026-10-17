# Módulo de usuários

## Objetivo

Concluir o módulo `users` com contratos tipados, entidade coerente e casos de
uso para cadastro, consulta e manutenção do perfil. O módulo deve fornecer ao
módulo `auth` apenas contratos públicos, sem expor seu repository.

Esta especificação inicia funcionalidades antes classificadas como pós-MVP.
Ela não amplia automaticamente o escopo dos módulos financeiros.

## Resultado esperado

- substituir todos os `Promise<any>` do contrato de persistência;
- separar operações de repository de casos de uso;
- permitir cadastro público com nome, nome de usuário, e-mail, telefone e senha;
- permitir consulta e atualização do próprio perfil autenticado;
- manter desativação, reativação e exclusão definitiva programada;
- manter o upload de imagem associado ao usuário autenticado;
- integrar a foto de perfil ao módulo `storage` por contrato público;
- preservar a role e as capabilities definidas por enums;
- expor um contrato público mínimo para autenticação e autorização;
- nunca devolver `passwordHash` em respostas HTTP.

## Escopo

### Incluído

- entidade `User` e seus invariantes;
- DTOs de entrada e saída baseados em schemas Zod na apresentação;
- cadastro público de usuário;
- consulta do perfil autenticado;
- atualização de nome, telefone e dados de perfil aprovados;
- desativação e reativação do usuário;
- exclusão definitiva de usuários inativos há mais de 30 dias;
- upload de imagem de perfil para o usuário autenticado;
- preservação e consulta interna de role e capabilities;
- contrato público consumido por `auth`;
- repository tipado e implementação Prisma;
- testes unitários e de integração proporcionais ao módulo.

### Fora do escopo

- login, logout, refresh e validação de JWT;
- recuperação de senha e envio de e-mail;
- confirmação de e-mail;
- amizades, grupos, metas e Telegram;
- painel operacional de administração;
- painel administrativo para alterar roles e capabilities;
- equipes, planos ou assinaturas;
- edição de `passwordHash` por uma rota genérica de perfil.

## Limite entre `users` e `auth`

`users` é dono da identidade, do perfil, do estado e das capabilities do
usuário. `auth` é dono da comprovação de credenciais, das sessões, dos tokens,
dos cookies e da recuperação de senha.

O módulo `auth` deve consumir uma porta pública de `users`. Ele não pode
importar ou consultar diretamente `IUsersRepository`.

## Requisitos funcionais

### USR-RF-001 — Cadastro público

O sistema DEVE cadastrar um usuário com `username`, `name`, `email`, `phone` e
`password`. O hash deve ser produzido antes da persistência, e a senha original
não pode ser salva nem registrada em logs.

### USR-RF-002 — Unicidade

O sistema DEVE rejeitar `email` ou `username` já utilizados, considerando a
normalização definida no design.

### USR-RF-003 — Perfil autenticado

O sistema DEVE retornar apenas o perfil correspondente ao `userId` fornecido
pelo contexto de autenticação. Quando existir uma imagem de perfil concluída,
`GET /api/v1/users/me` DEVE incluir uma URL pré-assinada temporária e seu
`expiresAt`, com validade de 30 minutos.

### USR-RF-004 — Atualização de perfil

O sistema DEVE permitir atualizar somente campos explicitamente aceitos pelo
caso de uso. Campos internos devem ser rejeitados pelo schema HTTP.

### USR-RF-005 — Ciclo de vida

O sistema DEVE permitir desativar e reativar um usuário sem apagar seu
histórico. Ao desativar, deve registrar `inactivatedAt`; ao reativar, deve
removê-lo.

### USR-RF-006 — Exclusão definitiva

O sistema DEVE permitir que um processo interno exclua usuários que permaneçam
inativos por mais de 30 dias, conforme a decisão já registrada no projeto.

### USR-RF-007 — Imagem de perfil

O sistema DEVE associar o upload ao `userId` autenticado. O cliente não pode
escolher outro usuário por body, query ou parâmetro de rota.

O módulo `users` DEVE solicitar ao contrato público de `storage` a persistência
de `StoredFile` com `contextType=USER_PROFILE`, `contextId=userId` e
`ownerUserId=userId`. A entidade pertence a `storage`; capa de grupo, anexo de
movimentação e comprovante continuam fora desta entrega.

### USR-RF-008 — Role e capabilities

O sistema DEVE manter `role` e `capabilities` na entidade por enums. Cadastro
público sempre atribui `USER` e não aceita esses campos do cliente. A alteração
administrativa de role e capabilities fica fora desta especificação.

### USR-RF-009 — Saída segura

O sistema NÃO DEVE incluir `passwordHash` em DTO, presenter, resposta HTTP ou
log.

## Critérios de aceitação

- [ ] `IUsersRepository` não possui `any` e não contém casos de uso.
- [ ] O erro de digitação `cpdateUser` não existe nos contratos finais.
- [ ] `createUser` e `registerUser` não permanecem como operações duplicadas.
- [ ] Cadastro rejeita e-mail e nome de usuário duplicados sem diferenciar
  letras maiúsculas e minúsculas.
- [ ] Usuários distintos podem possuir o mesmo telefone.
- [ ] Senhas são persistidas somente como hash.
- [ ] A senha de cadastro preserva espaços externos e não recebe `trim`.
- [ ] O perfil autenticado é obtido a partir de `request.auth.userId`.
- [ ] `GET /users/me` retorna `profileImage.url` e `profileImage.expiresAt`
  quando existe uma imagem concluída.
- [ ] O upload ignora qualquer `userId` enviado pelo cliente.
- [ ] A entidade mantém `status`, `createdAt`, `updatedAt` e `inactivatedAt`.
- [ ] Cadastro público atribui role `USER` e rejeita role ou capabilities
  enviados pelo cliente.
- [ ] A imagem de perfil é registrada como `StoredFile` no contexto do usuário
  autenticado.
- [ ] Desativação e reativação preservam o histórico.
- [ ] Nenhuma saída pública contém `passwordHash`.
- [ ] `auth` usa o contrato público de `users`, não seu repository.
- [ ] Testes cobrem sucesso, duplicidade, usuário inativo e acesso cruzado.

## Dependências

- `PasswordHasher` para cadastro;
- `IdGenerator` e `ClockProvider`;
- Prisma e PostgreSQL para persistência;
- `StorageGateway`, contrato público do módulo `storage`;
- `AppLogger` com mensagens em português;
- contratos HTTP compartilhados já implementados.

## Decisões confirmadas

- cadastro recebe `username`, `name`, `email`, `phone` e `password`;
- `status`, `createdAt` e `updatedAt` permanecem na entidade;
- capabilities permanecem no usuário;
- role permanece no usuário como enum `USER` ou `ADMIN`;
- cadastro público sempre cria role `USER`;
- capabilities continuam como enum, sem tabelas associativas;
- imagens usam uma entidade genérica vinculada por contexto;
- a entidade genérica pertence ao módulo `storage`;
- upload de imagem exige usuário autenticado;
- telefone não é único;
- e-mail e nome de usuário são únicos sem diferenciar maiúsculas de minúsculas;
- o módulo `storage` usa Cloudflare R2 e possui uma especificação própria;
- autenticação pode aceitar e-mail ou nome de usuário;
- `passwordHash` é interno;
- exclusão definitiva ocorre somente após 30 dias de inatividade;
- sessões, solicitações de reset e imagens são removidas em cascata com a
  exclusão definitiva.

## Decisões pendentes

- regras finais de formato de `phone`;
- campos de perfil que poderão ser alterados inicialmente;
- confirmação de e-mail antes do primeiro acesso;
- endpoint e autorização para alterar capabilities em uma especificação futura;
- política de remoção dos objetos de imagem após exclusão definitiva;
- política de integridade e limpeza do vínculo polimórfico
  `contextType + contextId`.

## Documentação a reconciliar

Após a implementação, a documentação geral deve deixar de afirmar que cadastro
público pertence apenas a uma etapa indefinida. Essa atualização deve ser feita
em tarefa própria para não misturar implementação e revisão ampla de escopo.
