# Gerenciador de Finanças - Minha Carteira

## Visão geral:
O **Gerenciador de Finanças** é uma aplicação web de gestão financeira pessoal criada para centralizar e simplificar o controle do dinheiro ao longo do mês. O sistema registra contas, receitas, despesas, categorias e movimentações recorrentes, e apresenta um dashboard mensal com os principais indicadores.

A primeira versão será desenvolvida como um MVP personalizado e também como um projeto de estudo Full Stack. Seu foco será oferecer uma visão clara da situação financeira atual, do valor realmente disponível e da distribuição dos gastos por categoria, criando uma base sólida para futuras funcionalidades, como metas, cartões, projeções, importação de extratos e integrações financeiras.

As funcionalidades iniciais do produto serão:
*   Cadastro e gerenciamento de contas financeiras;
*   Registro de receitas e despesas;
*   Criação e gerenciamento de categorias;
*   Dashboard financeiro mensal;
*   Cadastro de receitas e despesas recorrentes;
*   Resumo mensal por meio do dashboard e dos filtros de lançamentos.

### Fora do MVP

Ficam explicitamente fora desta primeira versão: cadastro público de usuários, recuperação ou redefinição de senha, equipes e permissões, planos e assinaturas, orçamentos independentes por categoria, metas financeiras completas, gestão de dívidas, investimentos detalhados, cartões e faturas, integrações bancárias, integração com canais de mensageria, movimentação automática de dinheiro, assistente com IA, múltiplas moedas, Redis, Cloudflare R2, cache distribuído, Lenis, Sentry e rate limiting avançado.

O acesso continua protegido por uma credencial única previamente configurada. Isso é diferente do cadastro de contas financeiras, que permanece no escopo.

## Funcionalidades pós-MVP

As funcionalidades abaixo não fazem parte da primeira entrega. Elas serão desenvolvidas somente depois que o MVP pessoal estiver concluído e validado.

### Cadastro público e acesso de usuários

* Permitir que qualquer pessoa crie uma conta com nome de usuário, nome,
  e-mail, telefone e senha.
* Exigir e-mail no cadastro e impedir e-mails duplicados.
* Permitir login, logout, manutenção de sessão e recuperação de senha.
* Permitir edição dos dados do perfil.
* Isolar contas financeiras, lançamentos, metas e participações entre usuários.
* Definir posteriormente se a confirmação do e-mail será obrigatória antes do primeiro acesso.

O cadastro público substitui o modelo inicial de uma única credencial previamente configurada, mas não altera o escopo do MVP atual.

#### Entidade `User`

A entidade de acesso planejada para a etapa pós-MVP possui os campos:

* `id`: identificador interno do usuário;
* `username`: nome único utilizado para identificar o perfil;
* `name`: nome de exibição;
* `email`: endereço utilizado no acesso e na comunicação;
* `phone`: telefone associado ao perfil;
* `passwordHash`: hash interno da senha, nunca exposto em respostas;
* `role`: papel amplo do usuário, inicialmente `USER` ou `ADMIN`;
* `capabilities`: conjunto de funcionalidades concedidas ao usuário;
* `status`: estado atual do usuário;
* `createdAt`: instante de criação;
* `updatedAt`: instante da última alteração;
* `inactivatedAt`: instante opcional da desativação.

O `email` e o `username` são obrigatórios e únicos sem diferenciar letras
maiúsculas e minúsculas. Ambos são normalizados para letras minúsculas antes da
persistência e protegidos por constraints únicas. As migrations também devem
impedir a persistência de valores não normalizados. `phone` é obrigatório, não
aceita valor vazio e não é único. Seu formato final continua pendente. O campo
`capabilities` controla
funcionalidades restritas sem introduzir planos, assinaturas ou permissões de
equipe.

#### Sessões e recuperação de senha

O access token expira em 15 minutos. O refresh token expira em cinco dias,
permanece sem rotação nesta versão e é persistido somente como hash. Os motivos
de revogação são `LOGOUT`, `PASSWORD_RESET`, `USER_DEACTIVATED`,
`ADMINISTRATIVE_ACTION` e `SECURITY_EVENT`.

Solicitações de recuperação e desafios armazenam metadata de auditoria. Esses
dados terão política de retenção, mas não serão usados inicialmente para
bloquear, aprovar ou classificar uma solicitação. A duração, anonimização e
remoção ainda precisam ser definidas.

Um processo agendado para encerrar solicitações e desafios pendentes ficará no
backlog. Ele poderá marcar registros vencidos como `EXPIRED` e desafios não
processáveis como `FAILED`, sem trocar senhas ou criar sessões. Solicitações de
reset também possuem o estado `FAILED`.

### Integração restrita com Telegram

* Utilizar a Telegram Bot API como canal de entrada para movimentações.
* Permitir a integração somente para usuários que possuam a capability
  `TELEGRAM_TRANSACTIONS`.
* Associar a identidade recebida do Telegram a um usuário do Minha Carteira.
* Impedir que conhecer um bot, identificador externo ou identificador de conversa
  conceda acesso aos dados financeiros.
* Reutilizar os casos de uso e as regras do módulo de movimentações, sem
  acessar diretamente seu repository.
* Proteger o processamento contra a criação duplicada de movimentações.
* Manter a integração desabilitada para os demais usuários.
* Persistir o vínculo e o estado inicial no PostgreSQL, sem exigir Redis.

A capability concede o direito de utilizar a integração, mas não cria nem
ativa automaticamente um vínculo com o Telegram. A identidade de mensageria
precisa estar associada, verificada e habilitada.

#### Entidade `MessagingIdentity`

A identidade externa de mensageria permanece separada da entidade `User` e
possui os campos:

* `id`: identificador interno do vínculo;
* `userId`: usuário proprietário da integração;
* `provider`: provedor externo, inicialmente `TELEGRAM`;
* `externalUserId`: identificador do usuário no provedor;
* `conversationId`: identificador da conversa utilizada pelo bot;
* `enabled`: indica se o processamento de mensagens está habilitado;
* `verifiedAt`: instante em que o vínculo foi verificado;
* `status`: estado do ciclo de vida do vínculo;
* `createdAt`: instante de criação;
* `updatedAt`: instante da última alteração.

`enabled` representa a liberação operacional do vínculo. `status` representa
seu ciclo de vida e aceita `PENDING_VERIFICATION`, `VERIFIED` e `REVOKED`. As
transições permitidas ainda precisam de uma decisão antes da implementação. O
par `provider` e `externalUserId` deve identificar no máximo um vínculo,
evitando que a mesma identidade externa seja associada a mais de um usuário.

#### Fluxo pós-MVP — processamento de uma mensagem do Telegram

1. A Telegram Bot API envia uma mensagem para o endpoint de integração.
2. A camada de apresentação valida o evento recebido e extrai os identificadores
   externos e o conteúdo aceito.
3. O caso de uso consulta o repository de identidades pelo provedor e pelo
   `externalUserId`.
4. O módulo de usuários valida se o proprietário está autorizado pela capability
   `TELEGRAM_TRANSACTIONS`.
5. O módulo de mensageria verifica `enabled`, `verifiedAt` e `status` antes de
   aceitar o comando.
6. O caso de uso interpreta os dados da movimentação e chama o contrato público
   do módulo de movimentações.
7. O módulo de movimentações aplica as mesmas validações utilizadas pela API
   web e persiste o resultado no PostgreSQL.
8. O adapter do Telegram envia ao usuário o resultado da operação.

A sintaxe inicial das mensagens, o uso de confirmação antes da persistência e
o tratamento de mensagens ambíguas permanecem pendentes de especificação.

### Amizades

* Buscar usuários e enviar solicitações de amizade.
* Aceitar, recusar ou cancelar solicitações.
* Listar e remover amizades.
* Utilizar amizades para facilitar convites e participação em grupos.
* Não permitir que uma amizade dê acesso a contas, saldos, receitas, despesas ou metas privadas.

### Metas individuais

* Criar uma meta privada com nome e descrição.
* Definir opcionalmente valor-alvo e data-alvo.
* Permitir metas com valor definido ou sem valor-alvo.
* Registrar contribuições manualmente, sempre pelo próprio usuário.
* Vincular cada contribuição a uma conta financeira de origem.
* Registrar a retirada do valor da conta financeira e somá-la ao acumulado da meta.
* Exibir total acumulado, percentual de progresso e valor restante quando houver valor-alvo.
* Permitir editar nome, descrição, valor-alvo e prazo.
* Permitir pausar, concluir e reabrir a meta.

### Grupos de economia

* Criar grupo individual ou coletivo.
* Definir nome e descrição.
* Definir opcionalmente valor-alvo e data-alvo.
* Convidar amigos e controlar aceitação dos convites.
* Permitir grupos com valor-alvo ou sem valor-alvo.
* Cada participante registra somente as próprias contribuições.
* Registrar contribuições manualmente e vinculá-las a uma conta financeira do participante.
* Retirar o valor contribuído da conta financeira e somá-lo ao acumulado do grupo.
* Exibir o total contribuído por participante e o total acumulado do grupo.
* Não exigir valor fixo ou contribuição igual entre participantes.
* Exibir percentual de progresso e valor restante quando houver valor-alvo.
* Permitir alterar o valor-alvo e a data-alvo depois da criação.
* Permitir ao criador administrar participantes, encerrar e concluir o grupo.
* Preservar o histórico das contribuições e das alterações do objetivo.

As contribuições são registros manuais. O sistema não movimenta dinheiro entre bancos nem executa pagamentos; ele apenas registra a retirada de uma conta financeira cadastrada e atualiza o progresso da meta ou do grupo.

## Problema(s):
*   **Informações financeiras descentralizadas:** saldos, receitas, despesas e compromissos podem ficar espalhados entre aplicativos bancários, faturas e anotações.
*   **Falta de clareza sobre o dinheiro disponível:** o saldo bancário não consolida, por si só, as diferentes contas e movimentações do usuário.
*   **Controle manual e repetitivo:** receitas e despesas recorrentes precisam ser lembradas e registradas mensalmente, aumentando a chance de esquecimentos.
*   **Baixa visibilidade dos hábitos de consumo:** sem categorização e indicadores consolidados, é difícil identificar para onde o dinheiro está indo e quais gastos aumentaram.
*   **Dificuldade para avaliar o resultado do mês:** sem um resumo consolidado, é difícil saber quanto foi recebido, gasto e economizado.

## Objetivo(s)/Proposta(s):
O objetivo do projeto é desenvolver uma aplicação de gestão financeira pessoal que ajude o usuário a organizar sua renda, compreender seus gastos e tomar decisões mais conscientes ao longo do mês.

A solução proposta centraliza contas, movimentações e categorias em um único ambiente. O usuário poderá registrar suas receitas e despesas, acompanhar os saldos e visualizar os principais indicadores em um dashboard mensal.

O sistema também permitirá cadastrar movimentações recorrentes para reduzir tarefas repetitivas e apresentará um resumo mensal das movimentações. Com isso, o produto deverá:
*   Oferecer uma visão consolidada da vida financeira;
*   Mostrar quanto dinheiro está efetivamente disponível;
*   Melhorar o controle de receitas, despesas e compromissos recorrentes;
*   Evidenciar padrões de consumo por meio de categorias e indicadores;
*   Criar uma base técnica evolutiva para novas funcionalidades.

## Telas/Sessões:

## Stacks:
*   **Back:** Node, Express, TypeScript
*   **Front:** Next + TypeScript + shadcn/ui + Tailwind CSS
*   **Banco de dados:** PostgreSQL
*   **ORM:** Prisma
*   **Libs:** Zod, shadcn/ui, react-hook-form, react-hot-toast, date-fns, slugify
*   **Hospedagem:** a definir depois do MVP
*   **Gerenciador de pacote:** Yarn 4
*   **Segurança:** cookies HttpOnly, Helmet, CORS, bcrypt e JWT

Redis, Cloudflare R2, Lenis, Sentry, rate limiting avançado e integrações bancárias ficam fora do MVP. Podem ser avaliados quando houver uma necessidade real.
## Comandos para instalação:
Backend:
*   `yarn init -y`
*   `yarn tsc --init`
*   `yarn add express`
*   `yarn add prisma @prisma/client @prisma/adapter-pg`
*   `yarn add helmet`
*   `yarn add cors`
*   `yarn add cookie-parser`
*   `yarn add compression`
*   `yarn add jsonwebtoken`
*   `yarn add bcrypt`
*   `yarn add zod`
*   `yarn add slugify`
*   `yarn add date-fns`
*   `yarn add pino pino-http`

Depedências de desenvolvimento:

*   `yarn add -D typescript`
*   `yarn add -D @types/node`
*   `yarn add -D @types/express`
*   `yarn add -D pino-pretty`
*   `yarn add -D @types/jsonwebtoken`
*   `yarn add -D @types/cookie-parser`
*   `yarn add -D @types/cors`
*   `yarn add -D @types/bcrypt`
*   `yarn add -D tsx`

Frontend:
*   `yarn create next-app`
*   `yarn dlx shadcn@latest init -t`
*   `yarn add tailwindcss @tailwindcss/vite`
*   `yarn add @hookform/resolvers`
*   `yarn dlx shadcn@latest add [component-name]`
*   `yarn add date-fns`
*   `yarn add lucide-react`
*   `yarn add react-hot-toast`
*   `yarn add react-hook-form`
*   `yarn add zod`
*   `yarn add recharts`
*   `yarn add react-number-format`
*   `yarn add @tanstack/react-query`
## Scripts:
Server Express:

```javascript
import "dotenv/config"
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(helmet());
app.use(compression());
app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true,
    })
);

app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok"
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("SERVIDOR RODANDO NA PORTA", PORT)
});
```

Conexão prisma:

```typescript
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("A variável de ambiente DATABASE_URL é obrigatória.");
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

export default prisma;
```

Secret de 64 caracteres: 

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O arquivo `prisma.config.ts` carrega `.env`, aponta para
`prisma/schema.prisma` e usa `DATABASE_URL` como datasource. A configuração da
URL é necessária para migrations e acesso ao banco, mas o schema pode ser
modelado e revisado antes da conexão estar disponível.

## Componentes CORE:
### 1\. Auth Management
Responsável pelo acesso privado com credenciais previamente configuradas, encerramento e manutenção da sessão e proteção das rotas privadas. Não há cadastro público nem recuperação de senha no MVP.

### 2\. Account Management
Responsável pelo cadastro e gerenciamento das contas financeiras do usuário, como conta corrente, carteira, conta digital, poupança e investimentos. Mantém o saldo inicial e fornece os dados necessários para o cálculo do saldo atual.

### 3\. Category Management
Responsável pelas categorias de receitas e despesas. Disponibiliza categorias padrão e permite que o usuário crie, edite e desative categorias personalizadas.

### 4\. Transaction Management
Módulo central do domínio financeiro. Responsável pelo registro, alteração de status, consulta e exclusão lógica de receitas e despesas, incluindo data, valor, categoria, conta, situação e observações. Os dados financeiros não são editados após a criação.

### 5\. Recurring Transaction Management
Responsável pelo cadastro e processamento de receitas e despesas recorrentes, como salário, aluguel, internet, faculdade e assinaturas. Gera os lançamentos de cada competência sem duplicidade.

### 6\. Dashboard & Financial Analytics
Responsável por consolidar e apresentar os principais indicadores do período: saldos, receitas, despesas, resultado mensal, gastos por categoria e lançamentos pendentes.

#### 7\. User Management

Responsável pelo cadastro público, perfil, isolamento dos dados e capabilities
de cada usuário. `passwordHash` permanece interno e não pode ser retornado por
controllers, presenters ou integrações.

#### 8\. Storage Management

Responsável pela entidade genérica `StoredFile`, pelo ciclo de vida do upload e pela
integração com o Cloudflare R2. Nesta etapa, somente a imagem de perfil será
funcional. O módulo `users` utilizará um contrato público de `storage`, sem
acessar seu repository ou o provider de storage.

`storage` é um módulo interno e não possui camada `presentation` nem rota HTTP.
O módulo consumidor recebe a requisição, define o contexto no backend e chama o
caso de uso de storage. O frontend não envia `contextType`, `contextId` ou
`ownerUserId`. No fluxo da foto de perfil, `users` verifica existência, status
ativo e propriedade antes dessa chamada. `storage` apenas valida e armazena o
arquivo e seus metadados; não consulta `users` nem interpreta suas regras.

A spec de `storage` será a primeira executada na próxima etapa de implementação.
Ela inclui a migração da integração atual de R2, hoje reunida em um arquivo
compartilhado chamado `aws/s3.service.ts`: configuração do client e operações de
storage serão componentes separados dentro de `storage/infrastructure`. A
nomenclatura própria do projeto será R2; `S3Client` permanece apenas como nome
do SDK compatível. `users` deixará de acessar o storage compartilhado e
consumirá o contrato público de `storage`. Essa prioridade não altera o recorte
do MVP financeiro.

Os estados definidos são `PROCESSING`, `UPLOADING`, `COMPLETED` e `FAILED`, nessa
ordem de processamento. Falhas permanecem como `FAILED` para limpeza posterior.
Quando necessário, o módulo retorna URL pré-assinada com validade de 30 minutos.
O único provider inicial é `CLOUDFLARE_R2`. Capa de grupo, anexo de movimentação
e comprovante permanecem reservados para evoluções futuras.

#### 9\. Messaging Integration

Responsável por vincular identidades externas, receber eventos da Telegram Bot
API e convertê-los em comandos para contratos públicos da aplicação. O módulo
não acessa diretamente repositories de usuários ou movimentações.

## Fluxos:

**HTTP Route → Authentication/Authorization Middleware → Controller → Zod Validation → Use Case → Domain Rules → Repository/Provider → PostgreSQL → Presenter → HTTP Response**

### Fluxo 5 — Cadastro de conta financeira
1. O usuário autenticado envia **name**, **type**, **institution**, **initialBalance**, **color** e **icon**.
2. O **AccountController** valida o DTO e obtém o **userId** da sessão.
3. O **CreateAccountUseCase**, do módulo **Account Management**, valida as regras de nome, tipo e valor monetário.
4. O caso de uso chama o **AccountRepository**, que salva a conta via Prisma no PostgreSQL associada ao usuário.
5. O **AccountPresenter** retorna a conta criada com status **201 Created**.

### Fluxo 6 — Cadastro de categoria personalizada
1. O usuário envia **name**, **type**, **color** e **icon**.
2. O **CategoryController** valida o DTO e repassa o usuário autenticado.
3. O **CreateCategoryUseCase** verifica pelo **CategoryRepository** se já existe categoria ativa de mesmo nome e tipo para o usuário.
4. O módulo aplica as regras de categoria personalizada e cria a entidade.
5. O **CategoryRepository** persiste a categoria no PostgreSQL.
6. O controller retorna a categoria criada com status **201 Created**.

### Fluxo 7 — Registro de receita ou despesa
1. O usuário envia **description**, **amount**, **type**, **transactionDate**, **accountId**, **categoryId**, **status** e **notes** opcionais.
2. O **TransactionController** valida tipos, formato monetário e data.
3. O **CreateTransactionUseCase**, do módulo **Transaction Management**, chama **AccountRepository** e **CategoryRepository** para validar existência, propriedade, estado ativo e compatibilidade da categoria.
4. As regras de domínio criam a movimentação e determinam se ela afeta o saldo atual.
5. O **TransactionRepository** persiste a movimentação no PostgreSQL dentro da unidade de trabalho.
6. O **TransactionPresenter** devolve a movimentação com status **201 Created**.

### Fluxo 8 — Confirmação de movimentação pendente
1. O usuário solicita a alteração de uma movimentação de **PENDING** para **CONFIRMED**.
2. O **TransactionController** valida o identificador e o novo status.
3. O **ChangeTransactionStatusUseCase** consulta a movimentação pelo **TransactionRepository** e valida sua propriedade.
4. O domínio impede transições inválidas e confirma a movimentação.
5. O **TransactionRepository** salva a alteração.
6. A API retorna a movimentação atualizada com status **200 OK**.

### Fluxo 9 — Cadastro de movimentação recorrente
1. O usuário envia os dados financeiros da recorrência, sua **frequency**, **startDate** e **endDate** opcional.
2. O **RecurringTransactionController** valida o DTO.
3. O **CreateRecurringRuleUseCase**, do módulo **Recurring Transaction Management**, valida conta, categoria, propriedade e compatibilidade por meio dos repositories correspondentes.
4. O domínio calcula a próxima data de geração e cria a regra ativa.
5. O **RecurringTransactionRepository** salva a regra no PostgreSQL.
6. A API retorna a recorrência criada com status **201 Created**.

### Fluxo 10 — Geração automática de recorrências
1. Um scheduler executa periodicamente o **ProcessDueRecurringTransactionsUseCase** sem passar por um controller público.
2. O caso de uso solicita ao **RecurringTransactionRepository** as regras ativas cuja próxima geração está vencida.
3. Para cada regra, o módulo valida se já existe uma instância para a mesma recorrência e **scheduledDate** (data prevista da ocorrência).
4. O módulo **Recurring Transaction Management** chama o **Transaction Management** para criar uma movimentação com status **PENDING**.
5. O **TransactionRepository** salva a movimentação e o **RecurringTransactionRepository** atualiza a próxima data de geração dentro da mesma transação de banco.
6. Uma restrição única no banco impede duplicidade mesmo em execuções concorrentes.
7. O processo registra sucessos e falhas em logs estruturados sem interromper as demais regras.

### Fluxo 11 — Consulta do dashboard
1. O cliente autenticado solicita o dashboard informando **competence**.
2. O **DashboardController** valida a competência.
3. O **GetDashboardUseCase**, do módulo **Dashboard & Financial Analytics**, solicita agregações ao **AccountRepository** e ao **TransactionRepository**.
4. O módulo calcula saldos, receitas, despesas, resultado, distribuição por categoria e lançamentos pendentes.
5. O **DashboardPresenter** retorna o agregado com status **200 OK**.

## Requisitos Funcionais (RFs):
### Auth Management
*   **RF-001 — Acesso privado:** o sistema deve permitir o login com a credencial previamente configurada.
*   **RF-002 — Sessão:** o sistema deve manter a sessão autenticada de forma segura entre as requisições.
*   **RF-003 — Logout:** o sistema deve permitir que o usuário encerre sua sessão.
*   **RF-004 — Proteção de acesso:** o sistema deve impedir o acesso não autenticado às funcionalidades e aos dados financeiros privados.

### Account Management
*   **RF-007 — Cadastro de conta:** o sistema deve permitir criar uma conta informando nome, tipo, instituição, saldo inicial, cor ou ícone.
*   **RF-008 — Consulta de contas:** o sistema deve listar as contas do usuário com seus respectivos saldos atuais.
*   **RF-009 — Edição de conta:** o sistema deve permitir editar os dados cadastrais de uma conta.
*   **RF-010 — Desativação de conta:** o sistema deve permitir desativar e reativar uma conta sem apagar seu histórico financeiro.
*   **RF-011 — Saldo consolidado:** o sistema deve apresentar a soma dos saldos das contas ativas.

### Category Management
*   **RF-012 — Categorias padrão:** o sistema deve disponibilizar categorias iniciais para receitas e despesas.
*   **RF-013 — Categoria personalizada:** o sistema deve permitir criar categorias personalizadas, definindo nome, tipo, cor e ícone.
*   **RF-014 — Edição de categoria:** o sistema deve permitir editar categorias personalizadas.
*   **RF-015 — Desativação de categoria:** o sistema deve permitir desativar e reativar uma categoria sem apagar movimentações vinculadas.
*   **RF-016 — Consulta de categorias:** o sistema deve listar separadamente as categorias disponíveis para receitas e despesas.

### Transaction Management
*   **RF-017 — Registro de movimentação:** o sistema deve permitir registrar uma receita ou despesa com descrição, valor, data, categoria, conta, situação e observações opcionais.
*   **RF-018 — Situação da movimentação:** o sistema deve permitir classificar uma movimentação como confirmada ou pendente.
*   **RF-020 — Exclusão de movimentação:** o sistema deve permitir excluir logicamente uma movimentação ativa, desde que ela não tenha sido excluída anteriormente.
*   **RF-021 — Confirmação de pendência:** o sistema deve permitir confirmar o pagamento ou recebimento de uma movimentação pendente.
*   **RF-022 — Consulta e filtros:** o sistema deve permitir consultar movimentações por período, tipo, situação, conta, categoria e texto.
*   **RF-023 — Atualização de saldo:** o sistema deve recalcular os saldos afetados após criar, confirmar ou excluir logicamente uma movimentação. Dados financeiros não são editados depois da criação.

### Recurring Transaction Management
*   **RF-030 — Cadastro de recorrência:** o sistema deve permitir cadastrar uma receita ou despesa recorrente com frequência, data inicial e, opcionalmente, data final.
*   **RF-031 — Geração de lançamentos:** o sistema deve gerar automaticamente um lançamento para cada ocorrência prevista da recorrência, conforme sua frequência e intervalo.
*   **RF-032 — Consulta de recorrências:** o sistema deve listar as recorrências ativas e inativas.
*   **RF-033 — Edição de recorrência:** os dados financeiros de um lançamento gerado são imutáveis; o sistema permite alterar apenas a regra para lançamentos futuros e confirmar o status do lançamento atual.
*   **RF-034 — Desativação de recorrência:** o sistema deve permitir interromper novas gerações sem apagar lançamentos anteriores.
*   **RF-035 — Controle de duplicidade:** o sistema deve impedir a geração de mais de um lançamento para a mesma combinação de regra recorrente e data prevista.

### Dashboard & Financial Analytics
*   **RF-036 — Seleção de competência:** o sistema deve permitir selecionar o mês e o ano exibidos no dashboard.
*   **RF-037 — Indicadores mensais:** o sistema deve apresentar saldo consolidado, receitas, despesas e resultado do mês.
*   **RF-038 — Gastos por categoria:** o sistema deve apresentar a distribuição das despesas por categoria.
*   **RF-039 — Compromissos próximos:** o sistema deve apresentar receitas e despesas pendentes ordenadas por vencimento.

## Requisitos Não Funcionais (RNFs):
### Segurança e privacidade
*   **RNF-001 — Proteção de senha:** as senhas devem ser armazenadas exclusivamente como hash seguro, nunca em texto puro.
*   **RNF-002 — Transporte seguro:** toda comunicação em produção deve utilizar HTTPS/TLS.
*   **RNF-003 — Sessão segura:** credenciais de sessão devem utilizar cookies `HttpOnly`, `Secure` em produção e política `SameSite` adequada.
*   **RNF-004 — Isolamento de dados:** toda operação deve validar no servidor a propriedade do recurso, impedindo acesso cruzado entre usuários.
*   **RNF-005 — Validação de entrada:** todos os dados recebidos pela API devem ser validados antes do processamento.
*   **RNF-006 — Proteção contra abuso:** a aplicação pode adicionar rate limiting em uma etapa posterior, caso seja publicada para acesso externo.
*   **RNF-007 — Dados sensíveis:** logs, mensagens de erro e respostas da API não devem expor senha, token, cookie ou informação financeira desnecessária.

### Desempenho e disponibilidade
*   **RNF-008 — Tempo de resposta:** em condições normais, 95% das operações CRUD devem responder em até 1 segundo e o dashboard em até 2 segundos.
*   **RNF-009 — Paginação:** consultas que possam crescer continuamente devem utilizar paginação.
*   **RNF-011 — Disponibilidade:** a aplicação deve buscar disponibilidade mensal mínima de 99,5%, desconsiderando manutenções programadas.
*   **RNF-012 — Backup:** o banco de dados de produção deve possuir backup automatizado e procedimento documentado de restauração.

### Qualidade e manutenção
*   **RNF-013 — Tipagem:** frontend e backend devem utilizar TypeScript com modo estrito habilitado.
*   **RNF-014 — Organização:** o backend deve preservar separação entre domínio, casos de uso, infraestrutura e camada HTTP.
*   **RNF-015 — Testes:** regras financeiras críticas devem possuir testes unitários; fluxos da API devem possuir testes de integração; e o fluxo principal deve possuir teste de ponta a ponta.
*   **RNF-016 — Observabilidade:** a API deve produzir logs estruturados internos. Ferramenta externa de monitoramento, retenção e pesquisa histórica será definida depois do MVP.
*   **RNF-017 — Documentação da API:** os contratos, parâmetros, respostas e erros da API devem ser documentados e versionados.
*   **RNF-018 — Migrações:** alterações no banco de dados devem ser realizadas por migrações versionadas e revisáveis.

### Experiência e compatibilidade
*   **RNF-019 — Responsividade:** a interface deve funcionar em desktop, tablet e celular sem perda das funções principais.
*   **RNF-020 — Acessibilidade:** os fluxos principais devem atender, no mínimo, aos critérios aplicáveis do WCAG 2.1 nível AA.
*   **RNF-021 — Compatibilidade:** a aplicação deve funcionar nas duas versões estáveis mais recentes de Chrome, Edge, Firefox e Safari.
*   **RNF-022 — Localização:** valores devem ser exibidos em Real brasileiro e datas no formato brasileiro, mantendo internamente precisão monetária e datas normalizadas.
*   **RNF-023 — Consistência visual:** a interface deve reutilizar componentes e tokens visuais do design system adotado.

## Regras de Negócio:
### Usuário e acesso
*   **RN-001 — Acesso privado:** o MVP possui uma única identidade de acesso, criada por configuração inicial; não há cadastro público.
*   **RN-002 — Dados privados:** todos os dados financeiros pertencem à identidade configurada e só podem ser acessados após autenticação.
*   **RN-003 — Autorização obrigatória:** toda operação protegida deve validar a sessão antes de consultar ou alterar dados.

### Contas, categorias e valores
*   **RN-004 — Precisão monetária:** valores financeiros devem possuir precisão de duas casas decimais e não podem ser armazenados como ponto flutuante binário.
*   **RN-005 — Valor de movimentação:** toda receita ou despesa deve possuir valor maior que zero; o tipo da movimentação define seu efeito no saldo.
*   **RN-006 — Saldo atual:** o saldo atual de uma conta corresponde ao saldo inicial somado às receitas confirmadas e subtraído das despesas confirmadas.
*   **RN-007 — Movimentações pendentes:** movimentações pendentes não alteram o saldo atual e devem participar apenas das projeções.
*   **RN-008 — Vínculos válidos:** uma movimentação só pode utilizar conta e categoria ativas pertencentes ao mesmo usuário.
*   **RN-009 — Compatibilidade da categoria:** receitas devem utilizar categorias de receita e despesas devem utilizar categorias de despesa.
*   **RN-010 — Preservação do histórico:** contas ou categorias com movimentações vinculadas não podem ser excluídas fisicamente; somente desativadas.
*   **RN-011 — Categorias padrão:** categorias padrão do sistema não podem ser editadas ou excluídas pelo usuário, mas podem ser desativadas para seu perfil.

### Movimentações e recorrências
*   **RN-013 — Competência:** cada movimentação deve pertencer à competência correspondente à sua data financeira, considerando o fuso horário configurado para o usuário.
*   **RN-014 — Imutabilidade das movimentações:** os dados financeiros de uma movimentação — descrição, valor, tipo, data, conta, categoria e observações — não podem ser editados depois da criação. Para corrigir esses dados, a movimentação deve ser excluída logicamente e outra deve ser criada. A alteração de status entre `PENDING` e `CONFIRMED` continua permitida enquanto a movimentação estiver ativa.
*   **RN-015 — Identidade da ocorrência recorrente:** cada combinação de regra recorrente e `scheduledDate` pode originar no máximo um lançamento. A competência mensal não é suficiente para identificar uma ocorrência, pois uma recorrência semanal pode gerar várias ocorrências no mesmo mês.
*   **RN-016 — Estado inicial da recorrência:** lançamentos gerados automaticamente devem nascer como pendentes e somente afetar o saldo após confirmação.
*   **RN-017 — Alteração da recorrência:** alterar a regra de recorrência afeta apenas lançamentos futuros ainda não gerados; lançamentos já existentes preservam seu histórico.
*   **RN-018 — Encerramento da recorrência:** uma recorrência sem data final continua gerando lançamentos até ser desativada.

### Dashboard mensal
*   **RN-019 — Totais realizados:** receitas, despesas e resultado devem considerar somente movimentações confirmadas e não excluídas.
*   **RN-020 — Pendências:** movimentações pendentes não alteram o saldo atual e aparecem separadamente no dashboard.
*   **RN-021 — Competência:** o dashboard aceita uma competência no formato `YYYY-MM` e agrega os lançamentos correspondentes ao mês selecionado.
*   **RN-022 — Moeda inicial:** o MVP opera exclusivamente em Real brasileiro (BRL); suporte a múltiplas moedas fica fora do escopo inicial.

## Contratos da API:

### 1\. Convenções HTTP
*   **Base URL:** todas as rotas funcionais do MVP devem utilizar o prefixo `/api/v1`. Rotas de infraestrutura, como `/health`, ficam fora desse contrato.
*   **Datas:** datas civis utilizam `YYYY-MM-DD`; competências utilizam `YYYY-MM`; timestamps utilizam ISO 8601 em UTC.
*   **Valores monetários:** valores entram e saem como strings decimais, por exemplo `"1250.50"`, e são convertidos para `Decimal` no backend.
*   **Moeda:** o MVP utiliza exclusivamente o código `BRL`.
*   **Identificadores:** recursos utilizam UUID e nunca expõem IDs incrementais internos.
*   **Autenticação:** access e refresh tokens são enviados por cookies seguros; tokens não são retornados no JSON.
*   **Idempotência:** a geração automática de recorrências deve possuir proteção contra processamento duplicado.

### 2\. Resposta de sucesso
Toda resposta JSON com conteúdo das rotas em **/api/v1** deve seguir o envelope:

```json
{
  "data": {}
}
```

O campo opcional **meta** contém metadados próprios da operação. Quando uma
mensagem de sucesso for necessária, ela deve ficar em **data.message**. Uma
resposta **204** não possui corpo.

O contrato detalhado está em
[`response.spec.md`](../backend/.specs/templates/http-contracts/response.spec.md).

### 3\. Resposta de erro

Falhas esperadas devem utilizar um erro tipado e ser convertidas por um
middleware global. Em produção, a resposta contém somente **status** e uma
**message** pública em português:

```json
{
  "status": 400,
  "message": "Campo inválido."
}
```

Erros inesperados retornam **500** e a mensagem genérica
**"Erro interno do servidor."**. Código interno, detalhes, stack, causa e
**requestId** não são expostos em produção. O contrato detalhado e as regras de
sanitização estão em
[`error.spec.md`](../backend/.specs/templates/http-contracts/error.spec.md).

### 4\. Contrato de paginação
Rotas de listagem paginada devem aceitar **page**, **pageSize**, **sortBy** e
**sortOrder** e responder:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Os valores padrão são **page=1** e **pageSize=20**. O limite máximo de
**pageSize** é 100. No MVP, esse contrato deve ser aplicado inicialmente a
**GET /api/v1/transactions**. Filtros e autorização devem ser iguais na
contagem e na consulta paginada.

O contrato detalhado está em
[`pagination.spec.md`](../backend/.specs/templates/http-contracts/pagination.spec.md).

### 5\. Logs estruturados internos

A API utiliza um contrato tipado de logging, implementado por um adapter Pino.
Em produção e homologação, cada registro ocupa uma linha JSON independente
(NDJSON). O formato não inclui automaticamente `pid`, `hostname`, `time`,
`msg`, objetos de request/response ou `durationMs`.

Os campos disponíveis são `timestamp`, `level`, `event`, `module`, `message`,
`requestId`, `context`, `http` e `error`. Os campos opcionais só aparecem quando
se aplicam ao evento. O `requestId` é um UUID interno gerado pelo backend para
cada requisição; o cliente não pode defini-lo e ele não é incluído em headers
ou corpos HTTP.

O catálogo inicial de módulos contém `http`, `server`, `auth`, `accounts`,
`categories`, `transactions`, `recurring-transactions` e `dashboard`. O
contexto aceita somente `operation`, `count`, `userId`, `accountId`,
`categoryId`, `transactionId` e `recurringTransactionId`. Senhas, tokens,
cookies, e-mails, valores financeiros, corpos HTTP e outros dados pessoais não
fazem parte dessa allowlist.

Eventos de infraestrutura implementados:

* `http.request.completed`: resumo único de uma requisição concluída;
* `http.request.aborted`: conexão interrompida antes da conclusão;
* `http.request.failed`: diagnóstico sanitizado registrado pelo handler global;
* `server.started`: inicialização confirmada do servidor;
* `server.failed`: falha de configuração ou inicialização.

O nível padrão é `debug` somente quando `NODE_ENV` vale exatamente
`development`; nos demais ambientes, é `info`. `LOG_LEVEL` aceita `debug`,
`info`, `warn`, `error` ou `fatal` e uma configuração inválida impede a
inicialização. O formato legível do `pino-pretty` é usado somente em
desenvolvimento, sem destino explícito e quando não foi desabilitado.

O contexto HTTP usa `AsyncLocalStorage`, preserva o identificador em chamadas
assíncronas e volta ao logger base depois do encerramento da resposta. Falhas
do próprio logger são isoladas e não alteram status, corpo, headers ou regras
de negócio. A saída local não representa auditoria durável, monitoramento
remoto ou garantia de retenção.

A adoção em services permanece pendente porque esses fluxos ainda não foram
implementados. Eventos de negócio só poderão ser emitidos depois da confirmação
real de cada operação. O contrato completo está em
[`spec.md`](../backend/.specs/templates/logs/spec.md).

### 6\. DTOs de entrada
#### Auth
*   **LoginInput:** `identifier`, `password`; o identificador aceita e-mail ou
    nome de usuário.

#### Users pós-MVP

* **CreateUserInput:** `username`, `name`, `email`, `phone`, `password`.

Todos os campos são strings obrigatórias e não aceitam valor vazio. `email`
também deve possuir um formato de endereço válido. Ainda não foram aprovadas
regras adicionais de formato para `username` e `phone`.

O schema HTTP remove espaços externos de `username`, `name`, `email` e
`phone`, normaliza `email` para letras minúsculas e rejeita campos internos
como `passwordHash`, `capabilities`, `status`, `createdAt` e `updatedAt`.
Enquanto a política de senha não for definida, `password` é obrigatória e não
pode conter somente espaços. O valor original da senha não é normalizado.

#### Accounts
*   **CreateAccountInput:** `name`, `type`, `institution?`, `initialBalance`, `color?`, `icon?`.
*   **UpdateAccountInput:** versão parcial dos campos editáveis de criação.
*   **ChangeAccountStatusInput:** `isActive`.

Tipos aceitos de conta: `CHECKING`, `CASH`, `DIGITAL`, `SAVINGS` e `INVESTMENT`.

#### Categories
*   **CreateCategoryInput:** `name`, `type`, `color?`, `icon?`.
*   **UpdateCategoryInput:** versão parcial dos campos editáveis.
*   **ChangeCategoryStatusInput:** `isActive`.

Tipos aceitos de categoria: `INCOME` e `EXPENSE`.

#### Transactions
*   **CreateTransactionInput:** `description`, `amount`, `type`, `transactionDate`, `accountId`, `categoryId`, `status`, `notes?`.
*   **ChangeTransactionStatusInput:** `status`.

Tipos: `INCOME` e `EXPENSE`. Situações: `PENDING` e `CONFIRMED`.

#### Recurring transactions
*   **CreateRecurringRuleInput:** `description`, `amount`, `type`, `accountId`, `categoryId`, `frequency`, `interval`, `startDate`, `endDate?`, `notes?`.
*   **UpdateRecurringRuleInput:** versão parcial dos campos editáveis.
*   **ChangeRecurringRuleStatusInput:** `isActive`.

Frequências iniciais: `WEEKLY`, `MONTHLY` e `YEARLY`. O campo **interval** deve ser um inteiro maior ou igual a 1.

### 7\. DTOs de saída
#### UserView
`id`, `name`, `email`, `createdAt`, `updatedAt`.

#### UserView pós-MVP

`id`, `username`, `name`, `email`, `phone`, `role`, `capabilities`, `status`,
`createdAt`, `updatedAt`, `inactivatedAt` e, quando existir, `profileImage`.

`profileImage` possui `id`, `url` e `expiresAt`. A `url` é pré-assinada,
temporária e válida por 30 minutos. O frontend deve renovar a representação
quando `expiresAt` for atingido; a URL não é persistida no cadastro do usuário.

O campo `passwordHash` nunca faz parte de um DTO de saída.

#### AccountView
`id`, `name`, `type`, `institution`, `initialBalance`, `currentBalance`, `currency`, `color`, `icon`, `isActive`, `createdAt`, `updatedAt`.

#### CategoryView
`id`, `name`, `type`, `color`, `icon`, `isDefault`, `isActive`, `createdAt`, `updatedAt`.

#### TransactionView
`id`, `description`, `amount`, `type`, `status`, `transactionDate`, `competence`, `account`, `category`, `notes`, `recurringRuleId`, `scheduledDate?`, `createdAt`, `updatedAt`.

#### RecurringRuleView
`id`, `description`, `amount`, `type`, `account`, `category`, `frequency`, `interval`, `startDate`, `endDate`, `nextGenerationDate`, `isActive`, `createdAt`, `updatedAt`.

#### DashboardView
`competence`, `consolidatedBalance`, `totalIncome`, `totalExpense`, `monthlyResult`, `categoryBreakdown`, `upcomingTransactions`.

### 8\. Contratos internos do backend
As interfaces pertencem à camada de aplicação ou domínio. Prisma, bcrypt e demais bibliotecas devem ser implementações substituíveis desses contratos.

#### Repositories
*   **AccessIdentityProvider:** valida a credencial privada previamente configurada e fornece a identidade da sessão.
*   **AccountRepository:** `findById`, `listByUser`, `create`, `update`, `changeStatus`, `getConsolidatedBalances`.
*   **CategoryRepository:** `findById`, `listByUser`, `findByNameAndType`, `create`, `update`, `changeStatus`.
*   **TransactionRepository:** `findById`, `listByFilters`, `create`, `softDelete`, `changeStatus`, `getMonthlySummary`, `getCategoryBreakdown`, `existsRecurringInstance(recurringRuleId, scheduledDate)`.
*   **RecurringTransactionRepository:** `findById`, `listByUser`, `findDueRules`, `create`, `update`, `changeStatus`, `updateNextGenerationDate`.

Todos os métodos devem receber o **userId** quando consultarem recursos privados.

#### Providers
*   **PasswordHasher:** `hash` e `compare`.
*   **SessionProvider:** `create`, `refresh`, `validate`, `revoke` e `revokeAllFromUser`.
*   **ClockProvider:** `now` e operações determinísticas de competência.
*   **IdGenerator:** `generate`.
*   **UnitOfWork:** executa operações que exigem atomicidade dentro de uma transação de banco.
*   **AppLogger:** emite eventos tipados sem acoplar casos de uso ao Pino ou ao Express.

### 9\. Regras de retorno dos casos de uso
*   Casos de uso não devem retornar objetos do Prisma diretamente.
*   Sucessos retornam entidades ou DTOs da aplicação.
*   Falhas esperadas retornam erros de domínio tipados.
*   Um middleware global converte erros de domínio em códigos HTTP.
*   Erros inesperados são registrados com **requestId** e convertidos em **INTERNAL\_ERROR**.
*   Presenters removem campos internos e formatam datas e valores monetários para o contrato HTTP.

## Arquitetura e padrões

O backend utilizará inicialmente **Onion Architecture** como abordagem de estudo,
combinada com princípios de **Domain-Driven Design (DDD)**, arquitetura em camadas,
Dependency Injection e Ports and Adapters. A solução não precisa seguir a Onion
Architecture de forma dogmática: a prioridade é manter responsabilidades claras,
baixo acoplamento e uma estrutura proporcional ao tamanho do projeto.

### Camadas internas

Cada módulo pode organizar seu código nas seguintes camadas:

* **Domain:** entidades, objetos de valor, eventos e regras de negócio puras.
  Não depende de Express, Prisma, PostgreSQL ou bibliotecas de infraestrutura.
* **Application:** casos de uso, DTOs de aplicação e portas que expressam as
  operações necessárias para executar cada caso de uso.
* **Infrastructure:** implementações concretas de repositories, providers,
  Prisma, bcrypt, JWT e acesso ao PostgreSQL.
* **Presentation:** rotas, controllers, schemas Zod, middlewares, presenters e
  conversão de erros para respostas HTTP.

### App, server e Composition Root

O backend separará a construção da aplicação da inicialização do processo HTTP:

* **App:** cria e configura a aplicação Express, registra middlewares, rotas e
  tratamento de erros, mas não inicia a porta de rede.
* **Server:** carrega a configuração de ambiente, obtém a aplicação pronta e
  inicia o servidor HTTP. Também será o ponto de encerramento controlado do
  processo.
* **Composition Root:** instancia repositories, providers, casos de uso,
  controllers e módulos concretos, injeta suas dependências e entrega a
  aplicação configurada ao `app`.

Uma organização inicial possível é:

```text
backend/src/
├── app/
│   ├── app.ts
│   ├── routes.ts
│   └── middlewares/
├── modules/
│   ├── auth/
│   ├── accounts/
│   ├── categories/
│   ├── transactions/
│   ├── recurring-transactions/
│   └── dashboard/
├── shared/
│   ├── domain/
│   ├── application/
│   └── infrastructure/
├── main/
│   └── composition-root.ts
└── server.ts
```

Essa estrutura é uma referência inicial, não uma obrigação de criar abstrações
para todos os arquivos. O código deve evoluir conforme as necessidades reais dos
casos de uso.

Depois da conclusão do MVP, os módulos `users` e `messaging` poderão ser
adicionados a `backend/src/modules/`. A integração concreta com a Telegram Bot
API pertence à infraestrutura do módulo de mensageria e deve implementar uma
porta definida pela aplicação.

### Dependency Injection e dependências entre módulos

As dependências serão fornecidas por **Dependency Injection**, preferencialmente
por construtores. Casos de uso não devem criar diretamente repositories,
providers ou clientes do Prisma.

Um módulo pode depender de outro quando houver uma necessidade de negócio, mas
deve utilizar um contrato público da camada de aplicação ou do domínio. Ele não
deve acessar diretamente o repository interno do outro módulo.

Exemplos:

* **Recurring Transactions** pode chamar um caso de uso ou uma porta pública de
  **Transactions** para criar uma ocorrência pendente.
* **Dashboard** pode consumir portas de consulta públicas de **Accounts** e
  **Transactions** para obter agregações.
* **Transactions** pode validar referências por portas públicas de **Accounts**
  e **Categories**.
* **Messaging** pode validar a capability do usuário pelo contrato público de
  **Users** e solicitar o registro financeiro pelo contrato público de
  **Transactions**.

O `Composition Root` conecta essas implementações sem transferir detalhes de
infraestrutura para o domínio ou para os casos de uso.

## Rotas da API:
Todas as rotas abaixo utilizam o prefixo **/api/v1**. A coluna “Auth” indica se a sessão autenticada é obrigatória.

### System

| Método | Rota      | Auth | Resultado                  |
| ------ | --------- | ---- | -------------------------- |
| GET    | `/health` | Não  | Estado básico da API — 200 |

### Auth Management

| Método | Rota            | Auth           | Resultado                              |
| ------ | --------------- | -------------- | -------------------------------------- |
| POST   | `/auth/login`   | Não            | Autentica e inicia sessão — 200        |
| POST   | `/auth/refresh` | Refresh cookie | Renova apenas o access token — 204     |
| POST   | `/auth/logout`  | Sim            | Revoga a sessão e remove cookies — 204 |
| GET    | `/auth/me`      | Sim            | Retorna o usuário autenticado — 200    |

### Account Management

| Método | Rota                          | Auth | Resultado                           |
| ------ | ----------------------------- | ---- | ----------------------------------- |
| GET    | `/accounts`                   | Sim  | Lista as contas e seus saldos — 200 |
| POST   | `/accounts`                   | Sim  | Cria uma conta — 201                |
| GET    | `/accounts/:accountId`        | Sim  | Consulta uma conta — 200            |
| PATCH  | `/accounts/:accountId`        | Sim  | Atualiza dados da conta — 200       |
| PATCH  | `/accounts/:accountId/status` | Sim  | Ativa ou desativa uma conta — 200   |

### Category Management

| Método | Rota                             | Auth | Resultado                                                     |
| ------ | -------------------------------- | ---- | ------------------------------------------------------------- |
| GET    | `/categories`                    | Sim  | Lista categorias; aceita filtro por `type` e `isActive` — 200 |
| POST   | `/categories`                    | Sim  | Cria uma categoria personalizada — 201                        |
| GET    | `/categories/:categoryId`        | Sim  | Consulta uma categoria — 200                                  |
| PATCH  | `/categories/:categoryId`        | Sim  | Atualiza uma categoria personalizada — 200                    |
| PATCH  | `/categories/:categoryId/status` | Sim  | Ativa ou desativa uma categoria — 200                         |

### Transaction Management

| Método | Rota                                  | Auth | Resultado                                              |
| ------ | ------------------------------------- | ---- | ------------------------------------------------------ |
| GET    | `/transactions`                       | Sim  | Lista com paginação e filtros — 200                    |
| GET    | `/transactions/:transactionId`        | Sim  | Consulta uma movimentação — 200                        |
| POST   | `/transactions`                       | Sim  | Registra receita ou despesa — 201                      |
| PATCH  | `/transactions/:transactionId/status` | Sim  | Confirma ou marca como pendente uma movimentação — 200 |
| DELETE | `/transactions/:transactionId`        | Sim  | Realiza exclusão lógica — 204                          |

Filtros previstos em **GET /transactions**: `competence`, `startDate`, `endDate`, `type`, `status`, `accountId`, `categoryId`, `search`, `page`, `pageSize`, `sortBy` e `sortOrder`.

### Recurring Transaction Management

| Método | Rota                                          | Auth | Resultado                          |
| ------ | --------------------------------------------- | ---- | ---------------------------------- |
| GET    | `/recurring-transactions`                     | Sim  | Lista regras recorrentes — 200     |
| POST   | `/recurring-transactions`                     | Sim  | Cria uma regra recorrente — 201    |
| GET    | `/recurring-transactions/:recurringId`        | Sim  | Consulta uma regra — 200           |
| PATCH  | `/recurring-transactions/:recurringId`        | Sim  | Atualiza lançamentos futuros — 200 |
| PATCH  | `/recurring-transactions/:recurringId/status` | Sim  | Ativa ou desativa a regra — 200    |

O processamento das recorrências é executado por um scheduler interno que chama diretamente o caso de uso. Não deve existir uma rota pública sem proteção para disparar esse processamento.

### Dashboard & Financial Analytics

| Método | Rota                            | Auth | Resultado                                     |
| ------ | ------------------------------- | ---- | --------------------------------------------- |
| GET    | `/dashboard?competence=YYYY-MM` | Sim  | Retorna indicadores e agregações do mês — 200 |

## Convencções:
*   Todo o projeto em inglês
*   Utilizar Gitflow. Toda funcionalidade deve ser desenvolvida em uma nova branch `feature/nome`.
*   Commits devem seguir regras de conventional commits ([https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/))
*   Classes, interfaces e types escritas em PascalCase
*   Nome de arquivos e pastas em kebab-case (backend)
*   funções e variáveis em camelCase
*   constantes globais em UPPER\_SNAKE\_CASE

## Funções dos serviços:

## Justificativa de decisões (perguntas / respostas):

### Decisões:
*   O MVP não possui `Salary Planning` nem `Monthly Closing`. O usuário acompanha o mês pelo dashboard e pelos filtros de lançamentos.
*   Recorrências geram lançamentos pendentes; confirmar o lançamento é uma ação manual e não movimenta dinheiro no banco.
*   O fechamento mensal, planejamento salarial e comparações planejado versus realizado podem ser avaliados em uma etapa futura, caso o uso real demonstre necessidade.
## Aprendizado(s):

## Anotações gerais/Lembretes:
