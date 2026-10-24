# Seed e reset dos dados de demonstração

Os comandos deste guia usam **somente `STG_DATABASE_URL`**, acompanhando
`backend/prisma.config.ts`. Eles não usam `DATABASE_URL` como alternativa.
O backend continua usando `DATABASE_URL` ao iniciar a aplicação. Para testar os
dados gerados pela API, configure a aplicação para acessar o mesmo banco.

## Preparar o ambiente

Execute os comandos dentro de `backend`, com as dependências instaladas pelo
Yarn 4 e as migrations aplicadas. Configure localmente em `backend/.env`:

| Variável | Uso |
| --- | --- |
| `NODE_ENV` | Obrigatoriamente `development`, `test` ou `staging`. |
| `STG_DATABASE_URL` | URL PostgreSQL do banco de demonstração. |
| `SEED_ADMIN_PASSWORD` | Senha do administrador, com pelo menos oito caracteres. |
| `SEED_USER_PASSWORD` | Senha compartilhada pelas três contas comuns de demonstração, com pelo menos oito caracteres. |
| `CLOUDFLARE_R2_BUCKET_NAME` | Bucket de demonstração acessado pela aplicação. |
| `CLOUDFLARE_R2_ENDPOINT` | Endpoint do R2. |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | Credencial com acesso ao bucket de demonstração. |
| `CLOUDFLARE_R2_SECRET_ID` | Segredo da credencial do R2. |
| `BCRYPT_SALT_ROUNDS` | Opcional; custo do bcrypt. O padrão é `12`, como na aplicação. |

Não coloque senhas nem credenciais neste documento ou em arquivos versionados.
O reset não precisa de senhas do seed nem de configuração do R2.

Antes do reset, pare a aplicação e outros processos que escrevam nesse banco.

O parâmetro `schema` da URL é respeitado pelos dois comandos. Sem esse parâmetro,
o destino é `public`. Os comandos bloqueiam produção pelo `NODE_ENV`; ainda é
necessário conferir que a URL e o bucket configurados pertencem ao ambiente de
demonstração. O nome da variável não comprova o ambiente do recurso remoto.

## Executar o seed

```powershell
cd backend
yarn prisma:generate
yarn prisma:seed
```

O primeiro comando gera o Prisma Client sem aplicar migrations. O segundo usa
`prisma db seed`, configurado para executar `prisma/scripts/seed/seed.ts`.
Se as tabelas ainda não existirem, o seed falha antes de inserir dados. Consulte
`yarn prisma:show` e aplique as migrations separadamente no ambiente autorizado.

### Dados criados

| Username | Papel e estado | Senha utilizada |
| --- | --- | --- |
| `seed_admin` | `ADMIN`, ativo. | `SEED_ADMIN_PASSWORD` |
| `seed_user` | `USER`, ativo. | `SEED_USER_PASSWORD` |
| `seed_telegram` | `USER`, ativo, com `TELEGRAM_TRANSACTIONS`. | `SEED_USER_PASSWORD` |
| `seed_inactive` | `USER`, inativo. | `SEED_USER_PASSWORD` |

Os e-mails são sintéticos, em `example.com`; eles não recebem mensagens. A conta
inativa permite testar a rejeição do login e a reativação administrativa.
Conceder a capacidade Telegram não cria uma integração ou identidade verificada.

O seed também cria:

- Uma solicitação de recuperação de senha já concluída e seu challenge consumido.
- Um challenge de reativação já expirado para o usuário inativo.
- Uma sessão já revogada e expirada para o usuário comum.
- Três imagens PNG mínimas de um pixel, uma para cada usuário inicialmente ativo.
  Elas são enviadas de verdade para `seed/users/<UUID>/avatar.png` no bucket R2
  configurado; os metadados ficam em `stored_files`.

Os históricos não fornecem tokens utilizáveis. Para obter uma sessão válida,
faça login com uma das contas ativas. As imagens exercitam armazenamento e URLs
assinadas; não são avatares ilustrados.

### Fluxo do seed

1. **Entrada:** variáveis do ambiente e fixtures sintéticas com UUIDs reservados.
2. **Validação:** ambiente, URL, senhas pelo schema de cadastro, entidades de
   usuário, imagem pelo validador do módulo de armazenamento e tabelas existentes.
3. **Persistência:** verifica conflitos de identidades e cria usuários e
   históricos ausentes em uma transação. As senhas passam pelo bcrypt existente.
4. **Arquivos:** utiliza o provedor R2 do projeto; registra `UPLOADING`, envia
   o PNG e marca `COMPLETED` somente após sucesso. Falhas ficam como `FAILED`.
5. **Resultado:** registra um resumo em português e encerra as conexões. Falhas
   encerram o comando com código diferente de zero.

### Repetição e falhas parciais

Os UUIDs fixos evitam duplicação de usuários e históricos. Reexecutar o seed
preserva senhas, papéis e estados das contas existentes, em vez de redefini-los.
Se uma identidade reservada conflitar com outro registro, o comando falha.
Para trocar as senhas das contas existentes, use o fluxo da aplicação ou faça
reset e seed novamente no banco descartável.

As imagens são reenviadas para as mesmas três chaves. O comando preserva outros
arquivos, inclusive imagens enviadas posteriormente pelo usuário; o perfil usa
as regras de seleção do módulo de armazenamento.

PostgreSQL e R2 não participam de uma transação conjunta. Uma falha de upload
pode ocorrer depois que usuários e históricos já foram criados. Corrija o
problema e execute o seed novamente. Não há envio de e-mails nesse processo.

## Apagar somente os dados

```powershell
cd backend
yarn prisma:reset
```

O comando exibe host, banco e schema e solicita que você digite exatamente
`APAGAR <banco>/<schema>`, usando os valores apresentados pelo próprio comando.
Sem confirmação correta, ele não conecta ao banco. O terminal deve ser
interativo; não existe opção de confirmação automática.

### Fluxo do reset

1. **Entrada:** `NODE_ENV`, `STG_DATABASE_URL` e confirmação digitada no terminal.
2. **Validação:** ambiente permitido, URL, confirmação e tabelas conhecidas.
   Tabelas obrigatórias ausentes ou tabelas desconhecidas interrompem o reset.
3. **Persistência:** abre uma transação e executa `DELETE` no schema selecionado,
   na ordem `challenges`, `messaging_identities` quando existir,
   `password_reset_requests`, `refresh_tokens`, `stored_files` e `users`.
4. **Resposta:** confirma a transação e registra as quantidades removidas por
   tabela. Se uma remoção falhar, desfaz toda a transação.

O reset preserva tabelas, índices, enums e `_prisma_migrations`. Não apaga arquivos
locais nem objetos no R2, não executa migrations e não roda o seed automaticamente.
Objetos anteriormente enviados ao R2 continuam no bucket, mesmo que seus
metadados tenham sido removidos do banco. A limpeza desses objetos é uma operação
separada.

## Pendências conhecidas

O schema declara `MessagingIdentity`, mas as migrations atuais não criam
`messaging_identities`. O seed cobre os módulos que já possuem tabelas migradas
e não insere identidades de mensageria. O reset inclui essa tabela somente se
ela existir. Estes scripts não corrigem essa divergência nem alteram migrations.

Se outros módulos ganharem tabelas, atualize a lista de manutenção e as fixtures
antes de usar estes comandos. Tabelas desconhecidas bloqueiam a operação.

## Verificar sem alterar serviços reais

```powershell
cd backend
yarn prisma:test-maintenance
```

Os testes usam clientes simulados para conferir destino, confirmação, ordem das
remoções e rollback. As fixtures são verificadas com os validadores e o bcrypt
locais. Eles não executam seed, reset, uploads nem comandos contra um banco real.
