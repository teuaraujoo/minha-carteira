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
- permitir consulta e atualização do próprio perfil autenticado; nesta etapa,
  somente nome e telefone;
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
- atualização de nome e telefone;
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
`password`. O telefone é obrigatório e deve estar no formato de celular
brasileiro `+55` + DDD com dois dígitos + `9` + oito dígitos, por exemplo
`+5579988887777`. O hash deve ser produzido antes da persistência, e a senha
original não pode ser salva nem registrada em logs.

O `username` DEVE rejeitar o caractere `@`, pois o login aceita e-mail e
username no mesmo campo `identifier`.

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
histórico enquanto a conta estiver inativa. A própria pessoa pode solicitar a
reativação por e-mail e confirmá-la por um link; um administrador também pode
reativar a conta. O link, gerenciado por `auth`, expira em 15 minutos, é de uso
único e permite três tentativas inválidas. Ao desativar, o sistema registra
`inactivatedAt` e revoga as sessões. Ao reativar, remove `inactivatedAt`,
invalida outros desafios pendentes e mantém as sessões antigas revogadas; a
pessoa precisa entrar novamente.

### USR-RF-006 — Exclusão definitiva

O sistema DEVE excluir definitivamente o usuário e os dados associados quando
completar 30 dias de desativação, desde que a conta não tenha sido reativada.
Isso inclui dados financeiros, identidades de mensageria, sessões, solicitações
de reset e imagens. A execução automática ficará para uma spec futura de
processos agendados; esta regra não aprova frequência nem tamanho de lote.

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

- [x] `IUsersRepository` não possui `any` e não contém casos de uso.
- [x] O erro de digitação `cpdateUser` não existe nos contratos finais.
- [x] Cadastro rejeita e-mail e nome de usuário duplicados sem diferenciar
  letras maiúsculas e minúsculas.
- [x] Usuários distintos podem possuir o mesmo telefone.
- [x] Senhas são persistidas somente como hash.
- [x] A senha de cadastro preserva espaços externos e não recebe `trim`.
- [x] O perfil autenticado é obtido a partir de `request.auth.userId`.
- [x] `GET /users/me` retorna `profileImage.url` e `profileImage.expiresAt`
  quando existe uma imagem concluída.
- [x] O upload ignora qualquer `userId` enviado pelo cliente.
- [x] A entidade mantém `status`, `createdAt`, `updatedAt` e `inactivatedAt`.
- [x] Cadastro público atribui role `USER` e rejeita role ou capabilities
  enviados pelo cliente.
- [x] Cadastro e atualização de perfil validam telefone brasileiro no formato
  aprovado `+55` + DDD de dois dígitos + `9` + oito dígitos.
- [x] A imagem de perfil é registrada como `StoredFile` no contexto do usuário
  autenticado.
- [x] Desativação e reativação preservam o histórico; links pendentes irmãos
  são invalidados ao reativar.
- [x] A reativação própria usa link via Resend, com validade de 15 minutos,
  uso único e até três tentativas inválidas; falha no envio marca o desafio
  como `FAILED`.
- [x] Uma reativação administrativa exige role `ADMIN`; nenhuma sessão antiga
  é restaurada.
- [x] Nenhuma saída pública contém `passwordHash`.
- [x] `auth` usa o contrato público de `users`, não seu repository.
- [ ] Testes HTTP integrados para perfil, upload, ciclo de vida, CSRF e IDOR
  foram adiados conforme decisão do usuário; os testes existentes são
  unitários/de controller.

## Dependências

- `PasswordHasher` para cadastro;
- `IdGenerator` e `ClockProvider`;
- Prisma e PostgreSQL para persistência;
- `StorageOperations`, contrato público do módulo `storage`;
- `AppLogger` com mensagens em português;
- contratos HTTP compartilhados já implementados.

## Decisões confirmadas

- cadastro recebe `username`, `name`, `email`, `phone` e `password`; telefone é
  obrigatório e segue o formato brasileiro de celular `+55` + DDD + número;
- `status`, `createdAt` e `updatedAt` permanecem na entidade;
- capabilities permanecem no usuário;
- role permanece no usuário como enum `USER` ou `ADMIN`;
- cadastro público sempre cria role `USER`;
- capabilities continuam como enum, sem tabelas associativas;
- `username` não pode conter `@`, para distinguir username de e-mail no login;
- imagens usam uma entidade genérica vinculada por contexto;
- a entidade genérica pertence ao módulo `storage`;
- upload de imagem exige usuário autenticado;
- telefone não é único;
- atualização de perfil autenticado permite alterar somente nome e telefone
  nesta etapa;
- e-mail e nome de usuário são únicos sem diferenciar maiúsculas de minúsculas;
- o módulo `storage` usa Cloudflare R2 e possui uma especificação própria;
- autenticação pode aceitar e-mail ou nome de usuário;
- `passwordHash` é interno;
- a desativação registra `inactivatedAt` e revoga sessões;
- a própria pessoa confirma por link a reativação, e administradores também
  podem reativar; sessões antigas não são restauradas;
- o link de reativação é enviado pelo Resend, expira em 15 minutos, é de uso
  único, permite três tentativas inválidas e reutiliza `Challenge` com propósito
  `ACCOUNT_REACTIVATION`; reativar invalida os outros desafios pendentes;
- falha no envio do link marca o desafio como `FAILED`; não há reenvio
  automático;
- login, desativação e reativação coordenam o bloqueio da linha do usuário para
  serializar gravação de sessão, mudança de status e revogação;
- a exclusão definitiva ocorre ao completar 30 dias de desativação, se não
  houver reativação, e apaga dados financeiros e identidades de mensageria,
  além dos registros de auth e imagens associados;
- a rotina automática de exclusão será especificada futuramente junto a outros
  processos agendados; frequência e tamanho de lote ainda não foram definidos.

## Decisões pendentes

- confirmação de e-mail antes do primeiro acesso;
- endpoint e autorização para alterar capabilities em uma especificação futura;
- política de integridade e limpeza do vínculo polimórfico
  `contextType + contextId`.

## Validações pendentes

- adicionar e executar testes HTTP integrados para perfil, upload, ciclo de
  vida, CSRF e IDOR. Esses testes foram adiados conforme decisão do usuário;
- validar migrations e repositories com PostgreSQL após configurar
  `DATABASE_URL`; essa validação foi adiada conforme decisão do usuário;
- escrever a spec futura de processos agendados para definir execução,
  frequência, tamanho de lote e tratamento de falhas na limpeza definitiva.
