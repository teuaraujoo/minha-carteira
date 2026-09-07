# Gerenciador de Finanças - Minha Carteira

## Visão geral:
O **Gerenciador de Finanças** é uma aplicação web de gestão financeira pessoal criada para centralizar e simplificar o controle do dinheiro ao longo do mês. O sistema acompanhará o ciclo financeiro completo do usuário: cadastro de contas, entrada do salário, planejamento da distribuição da renda, registro de receitas e despesas, acompanhamento por categorias, controle de movimentações recorrentes e fechamento mensal.

A primeira versão será desenvolvida como um MVP personalizado e também como um projeto de estudo Full Stack. Seu foco será oferecer uma visão clara da situação financeira atual, do valor realmente disponível e da relação entre o que foi planejado e o que foi realizado, criando uma base sólida para futuras funcionalidades, como metas, cartões, projeções, importação de extratos e integrações financeiras.

As funcionalidades iniciais do produto serão:
*   Cadastro e gerenciamento de contas financeiras;
*   Registro de receitas e despesas;
*   Criação e gerenciamento de categorias;
*   Dashboard financeiro mensal;
*   Planejamento e distribuição do salário;
*   Cadastro de receitas e despesas recorrentes;
*   Fechamento e resumo financeiro do mês.

## Problema(s):
*   **Informações financeiras descentralizadas:** saldos, receitas, despesas e compromissos podem ficar espalhados entre aplicativos bancários, faturas e anotações.
*   **Falta de clareza sobre o dinheiro disponível:** o saldo bancário não considera, por si só, contas futuras, valores reservados e gastos planejados.
*   **Dificuldade para planejar o salário:** sem uma distribuição prévia da renda, torna-se mais difícil definir quanto será destinado a despesas fixas, gastos do cotidiano, lazer, reserva e outros objetivos.
*   **Controle manual e repetitivo:** receitas e despesas recorrentes precisam ser lembradas e registradas mensalmente, aumentando a chance de esquecimentos.
*   **Baixa visibilidade dos hábitos de consumo:** sem categorização e indicadores consolidados, é difícil identificar para onde o dinheiro está indo e quais gastos aumentaram.
*   **Ausência de acompanhamento entre planejado e realizado:** o usuário pode definir intenções para o mês, mas não possui uma visão centralizada para verificar se está seguindo o planejamento.
*   **Dificuldade para avaliar o resultado do mês:** sem um fechamento financeiro, não há clareza sobre quanto foi recebido, gasto e economizado, nem sobre a evolução em relação aos meses anteriores.

## Objetivo(s)/Proposta(s):
O objetivo do projeto é desenvolver uma aplicação de gestão financeira pessoal que ajude o usuário a organizar sua renda, compreender seus gastos e tomar decisões mais conscientes ao longo do mês.

A solução proposta centraliza contas, movimentações e categorias em um único ambiente. Após registrar o salário, o usuário poderá planejar sua distribuição, acompanhar o valor planejado em comparação com o realizado e visualizar os principais indicadores em um dashboard mensal.

O sistema também permitirá cadastrar movimentações recorrentes para reduzir tarefas repetitivas e realizará um fechamento mensal com o resumo de receitas, despesas e economia do período. Com isso, o produto deverá:
*   Oferecer uma visão consolidada da vida financeira;
*   Mostrar quanto dinheiro está efetivamente disponível;
*   Facilitar o planejamento e a distribuição do salário;
*   Melhorar o controle de receitas, despesas e compromissos recorrentes;
*   Evidenciar padrões de consumo por meio de categorias e indicadores;
*   Permitir a comparação entre o planejamento e a execução do mês;
*   Criar uma base técnica evolutiva para novas funcionalidades.
## Telas/Sessões:
## Stacks:
*   **Back:** Node, Express, TypeScript
*   **Front:** Next + TypeScript + ShacnUI + Tailwind CSS + Lenis.js
*   **Banco de dados:** Postegre + Redis + Cloudflare R2
*   **ORM:** Prisma
*   **Libs:** Zod, Shadcn, react-hook-form, toastfy, date-fns, lenis.js, slugify
*   **Hospedagem:** Vercel + Oracle ou Hostinger + Render ou Vercel + Render
*   **Gerenciador de pacote:** Yarn 4
*   Segurança: Rate Limit Express, Cloudflare, Sentry
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

```javascript
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export default prisma;
```

## Componentes CORE:
### 1\. Auth Management
Responsável pelo cadastro, autenticação, encerramento e manutenção da sessão do usuário, recuperação de acesso e proteção das rotas privadas.

### 2\. Account Management
Responsável pelo cadastro e gerenciamento das contas financeiras do usuário, como conta corrente, carteira, conta digital, poupança e investimentos. Mantém o saldo inicial e fornece os dados necessários para o cálculo do saldo atual.

### 3\. Category Management
Responsável pelas categorias de receitas e despesas. Disponibiliza categorias padrão e permite que o usuário crie, edite e desative categorias personalizadas.

### 4\. Transaction Management
Módulo central do domínio financeiro. Responsável pelo registro, edição, consulta e exclusão lógica de receitas e despesas, incluindo data, valor, categoria, conta, situação e observações.

### 5\. Salary Planning
Responsável pelo planejamento mensal do salário. Permite definir o valor-base do mês, distribuí-lo entre categorias ou destinos financeiros e acompanhar o planejado em comparação com o realizado.

### 6\. Recurring Transaction Management
Responsável pelo cadastro e processamento de receitas e despesas recorrentes, como salário, aluguel, internet, faculdade e assinaturas. Gera os lançamentos de cada competência sem duplicidade.

### 7\. Dashboard & Financial Analytics
Responsável por consolidar e apresentar os principais indicadores financeiros do período: saldos, receitas, despesas, resultado mensal, projeção, gastos por categoria, contas próximas e comparação com o mês anterior.

### 8\. Monthly Closing
Responsável pelo fechamento financeiro do mês, geração do resumo consolidado, histórico de fechamentos e controle de reabertura quando alguma correção for necessária.

## Fluxos:

**HTTP Route → Authentication/Authorization Middleware → Controller → Zod Validation → Use Case → Domain Rules → Repository/Provider → PostgreSQL/Redis → Presenter → HTTP Response**

### Fluxo 5 — Cadastro de conta financeira
1. O usuário autenticado envia **name**, **type**, **institution**, **initialBalance**, **color** e **icon**.
2. O **AccountController** valida o DTO e obtém o **userId** da sessão.
3. O **CreateAccountUseCase**, do módulo **Account Management**, valida as regras de nome, tipo e valor monetário.
4. O caso de uso chama o **AccountRepository**, que salva a conta via Prisma no PostgreSQL associada ao usuário.
5. O **CacheProvider** invalida os agregados de contas e dashboard daquele usuário.
6. O **AccountPresenter** retorna a conta criada com status **201 Created**.

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
4. O caso de uso consulta o **MonthlyClosingRepository** para garantir que a competência está aberta.
5. As regras de domínio criam a movimentação e determinam se ela afeta o saldo atual ou apenas a projeção.
6. O **TransactionRepository** persiste a movimentação no PostgreSQL dentro da unidade de trabalho.
7. O **CacheProvider** invalida saldos, dashboard, planejamento realizado e prévia de fechamento da competência.
8. O **TransactionPresenter** devolve a movimentação com status **201 Created**.

### Fluxo 8 — Confirmação de movimentação pendente
1. O usuário solicita a alteração de uma movimentação de **PENDING** para **CONFIRMED**.
2. O **TransactionController** valida o identificador e o novo status.
3. O **ChangeTransactionStatusUseCase** consulta a movimentação pelo **TransactionRepository** e valida sua propriedade.
4. O caso de uso verifica no **MonthlyClosingRepository** se a competência permanece aberta.
5. O domínio impede transições inválidas e confirma a movimentação.
6. O **TransactionRepository** salva a alteração.
7. Os caches de saldo, dashboard, planejamento e fechamento são invalidados.
8. A API retorna a movimentação atualizada com status **200 OK**.

### Fluxo 9 — Criação ou atualização do planejamento salarial
1. O usuário envia a **competence**, o **baseAmount** e uma lista de **allocations**.
2. O **SalaryPlanController** valida o formato da competência, valores e estrutura das alocações.
3. O **UpsertSalaryPlanUseCase**, do módulo **Salary Planning**, verifica no **MonthlyClosingRepository** se o mês está aberto.
4. O caso de uso consulta as categorias relacionadas pelo **CategoryRepository** e valida a propriedade delas.
5. O domínio calcula percentuais, total distribuído e valor não alocado, impedindo que as alocações ultrapassem o salário-base.
6. O **SalaryPlanRepository** cria ou atualiza o único planejamento ativo da competência no PostgreSQL.
7. O **CacheProvider** invalida os dados de planejamento e dashboard.
8. O **SalaryPlanPresenter** retorna o planejamento calculado com status **201 Created** na criação ou **200 OK** na atualização.

### Fluxo 10 — Cadastro de movimentação recorrente
1. O usuário envia os dados financeiros da recorrência, sua **frequency**, **startDate** e **endDate** opcional.
2. O **RecurringTransactionController** valida o DTO.
3. O **CreateRecurringRuleUseCase**, do módulo **Recurring Transaction Management**, valida conta, categoria, propriedade e compatibilidade por meio dos repositories correspondentes.
4. O domínio calcula a próxima data de geração e cria a regra ativa.
5. O **RecurringTransactionRepository** salva a regra no PostgreSQL.
6. A API retorna a recorrência criada com status **201 Created**.

### Fluxo 11 — Geração automática de recorrências
1. Um scheduler executa periodicamente o **ProcessDueRecurringTransactionsUseCase** sem passar por um controller público.
2. O caso de uso solicita ao **RecurringTransactionRepository** as regras ativas cuja próxima geração está vencida.
3. Para cada regra, o módulo valida se já existe uma instância para a mesma recorrência e competência.
4. O módulo **Recurring Transaction Management** chama o **Transaction Management** para criar uma movimentação com status **PENDING**.
5. O **TransactionRepository** salva a movimentação e o **RecurringTransactionRepository** atualiza a próxima data de geração dentro da mesma transação de banco.
6. Uma restrição única no banco impede duplicidade mesmo em execuções concorrentes.
7. O **CacheProvider** invalida os dados do período afetado.
8. O processo registra sucessos e falhas em logs estruturados sem interromper as demais regras.

### Fluxo 12 — Consulta do dashboard
1. O cliente autenticado solicita o dashboard informando **competence**.
2. O **DashboardController** valida a competência.
3. O **GetDashboardUseCase**, do módulo **Dashboard & Financial Analytics**, consulta primeiro o **CacheProvider**.
4. Se não houver cache válido, o caso de uso solicita agregações ao **AccountRepository**, **TransactionRepository**, **SalaryPlanRepository** e **MonthlyClosingRepository**.
5. O módulo calcula saldos, receitas, despesas, resultado, projeção, distribuição por categoria, comparação mensal e progresso do planejamento.
6. O resultado é armazenado no Redis com tempo de vida curto.
7. O **DashboardPresenter** retorna o agregado com status **200 OK**.

### Fluxo 13 — Fechamento mensal
1. O usuário solicita a prévia de fechamento de uma competência.
2. O **MonthlyClosingController** valida a competência e chama o **PreviewMonthlyClosingUseCase**.
3. O caso de uso consulta movimentações, planejamento e pendências pelos respectivos repositories.
4. O módulo **Monthly Closing** calcula receitas, despesas, economia, desvios e pendências.
5. Para confirmar, o cliente envia novamente a competência e o sinalizador **acknowledgePendingTransactions** quando existirem pendências.
6. O **CloseMonthUseCase** revalida todos os dados, impede fechamento duplicado e exige a confirmação das pendências.
7. O **MonthlyClosingRepository** salva um snapshot do resumo e marca a competência como fechada dentro de uma transação de banco.
8. O cache do período é invalidado e a API retorna o fechamento com status **201 Created**.

### Fluxo 14 — Reabertura mensal
1. O usuário solicita a reabertura informando a competência e o **reason**.
2. O **MonthlyClosingController** valida o contrato e chama o **ReopenMonthUseCase**.
3. O caso de uso consulta o fechamento pelo **MonthlyClosingRepository** e valida sua propriedade e seu estado.
4. O módulo registra data, hora e motivo, marca o snapshot anterior como invalidado e reabre a competência.
5. O repository persiste a alteração no PostgreSQL.
6. O cache do período é invalidado.
7. A API retorna o novo estado da competência com status **200 OK**.

## Requisitos Funcionais (RFs):
### Auth Management
*   **RF-001 — Cadastro:** o sistema deve permitir o cadastro de usuário com nome, e-mail e senha.
*   **RF-002 — Autenticação:** o sistema deve permitir o login utilizando e-mail e senha válidos.
*   **RF-003 — Sessão:** o sistema deve manter a sessão autenticada de forma segura entre as requisições.
*   **RF-004 — Logout:** o sistema deve permitir que o usuário encerre sua sessão.
*   **RF-005 — Recuperação de acesso:** o sistema deve permitir a solicitação de redefinição de senha por e-mail.
*   **RF-006 — Proteção de acesso:** o sistema deve impedir o acesso não autenticado às funcionalidades e aos dados financeiros privados.

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
*   **RF-020 — Exclusão de movimentação:** o sistema deve permitir excluir logicamente uma movimentação enquanto sua competência estiver aberta.
*   **RF-021 — Confirmação de pendência:** o sistema deve permitir confirmar o pagamento ou recebimento de uma movimentação pendente.
*   **RF-022 — Consulta e filtros:** o sistema deve permitir consultar movimentações por período, tipo, situação, conta, categoria e texto.
*   **RF-023 — Atualização de saldo:** o sistema deve recalcular os saldos afetados após criar, editar, confirmar ou excluir uma movimentação.

### Salary Planning
*   **RF-024 — Planejamento mensal:** o sistema deve permitir criar um planejamento para uma competência mensal, informando o valor-base do salário.
*   **RF-025 — Distribuição do salário:** o sistema deve permitir distribuir o salário entre categorias ou destinos financeiros por valor ou percentual.
*   **RF-026 — Resumo do planejamento:** o sistema deve mostrar o total distribuído, o percentual distribuído e o valor ainda não alocado.
*   **RF-027 — Planejado versus realizado:** o sistema deve comparar, por destino, os valores planejados com as despesas confirmadas no mês.
*   **RF-028 — Edição do planejamento:** o sistema deve permitir editar o planejamento enquanto a competência estiver aberta.
*   **RF-029 — Histórico de planejamentos:** o sistema deve permitir consultar planejamentos de competências anteriores.

### Recurring Transaction Management
*   **RF-030 — Cadastro de recorrência:** o sistema deve permitir cadastrar uma receita ou despesa recorrente com frequência, data inicial e, opcionalmente, data final.
*   **RF-031 — Geração de lançamentos:** o sistema deve gerar automaticamente o lançamento correspondente a cada competência da recorrência.
*   **RF-032 — Consulta de recorrências:** o sistema deve listar as recorrências ativas e inativas.
*   **RF-033 — Edição de recorrência:** o sistema deve permitir editar somente o lançamento atual ou a regra para os lançamentos futuros.
*   **RF-034 — Desativação de recorrência:** o sistema deve permitir interromper novas gerações sem apagar lançamentos anteriores.
*   **RF-035 — Controle de duplicidade:** o sistema deve impedir a geração de mais de um lançamento da mesma recorrência para a mesma competência.

### Dashboard & Financial Analytics
*   **RF-036 — Seleção de competência:** o sistema deve permitir selecionar o mês e o ano exibidos no dashboard.
*   **RF-037 — Indicadores mensais:** o sistema deve apresentar saldo consolidado, receitas, despesas, resultado do mês e saldo projetado.
*   **RF-038 — Gastos por categoria:** o sistema deve apresentar a distribuição das despesas por categoria.
*   **RF-039 — Compromissos próximos:** o sistema deve apresentar receitas e despesas pendentes ordenadas por vencimento.
*   **RF-040 — Comparação mensal:** o sistema deve comparar receitas, despesas e resultado com a competência anterior.
*   **RF-041 — Uso do salário:** o sistema deve apresentar quanto e qual percentual do salário planejado já foi utilizado.
*   **RF-042 — Acompanhamento do plano:** o sistema deve apresentar o progresso de cada destino definido no planejamento mensal.

### Monthly Closing
*   **RF-043 — Prévia do fechamento:** o sistema deve gerar uma prévia com receitas, despesas, economia, pendências e desvios do planejamento.
*   **RF-044 — Fechamento da competência:** o sistema deve permitir confirmar o fechamento mensal.
*   **RF-045 — Histórico de fechamentos:** o sistema deve manter e permitir consultar os resumos dos meses fechados.
*   **RF-046 — Reabertura da competência:** o sistema deve permitir reabrir um mês fechado para correções, registrando a operação.
*   **RF-047 — Recálculo do fechamento:** após uma reabertura, o sistema deve gerar um novo resumo quando a competência for fechada novamente.

## Requisitos Não Funcionais (RNFs):
### Segurança e privacidade
*   **RNF-001 — Proteção de senha:** as senhas devem ser armazenadas exclusivamente como hash seguro, nunca em texto puro.
*   **RNF-002 — Transporte seguro:** toda comunicação em produção deve utilizar HTTPS/TLS.
*   **RNF-003 — Sessão segura:** credenciais de sessão devem utilizar cookies `HttpOnly`, `Secure` em produção e política `SameSite` adequada.
*   **RNF-004 — Isolamento de dados:** toda operação deve validar no servidor a propriedade do recurso, impedindo acesso cruzado entre usuários.
*   **RNF-005 — Validação de entrada:** todos os dados recebidos pela API devem ser validados antes do processamento.
*   **RNF-006 — Proteção contra abuso:** endpoints de autenticação e operações sensíveis devem possuir rate limiting.
*   **RNF-007 — Dados sensíveis:** logs, mensagens de erro e respostas da API não devem expor senha, token, cookie ou informação financeira desnecessária.

### Desempenho e disponibilidade
*   **RNF-008 — Tempo de resposta:** em condições normais, 95% das operações CRUD devem responder em até 1 segundo e o dashboard em até 2 segundos.
*   **RNF-009 — Paginação:** consultas que possam crescer continuamente devem utilizar paginação.
*   **RNF-010 — Cache:** dados agregados do dashboard podem utilizar cache, desde que sejam invalidados quando uma movimentação relacionada for alterada.
*   **RNF-011 — Disponibilidade:** a aplicação deve buscar disponibilidade mensal mínima de 99,5%, desconsiderando manutenções programadas.
*   **RNF-012 — Backup:** o banco de dados de produção deve possuir backup automatizado e procedimento documentado de restauração.

### Qualidade e manutenção
*   **RNF-013 — Tipagem:** frontend e backend devem utilizar TypeScript com modo estrito habilitado.
*   **RNF-014 — Organização:** o backend deve preservar separação entre domínio, casos de uso, infraestrutura e camada HTTP.
*   **RNF-015 — Testes:** regras financeiras críticas devem possuir testes unitários; fluxos da API devem possuir testes de integração; e o fluxo principal deve possuir teste de ponta a ponta.
*   **RNF-016 — Observabilidade:** a API deve produzir logs estruturados e a aplicação deve registrar erros inesperados em uma ferramenta de monitoramento.
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
*   **RN-001 — E-mail único:** cada e-mail normalizado pode pertencer a somente um usuário.
*   **RN-002 — Propriedade dos dados:** contas, categorias, movimentações, planejamentos, recorrências e fechamentos pertencem a um único usuário.
*   **RN-003 — Autorização obrigatória:** conhecer o identificador de um recurso não autoriza sua consulta ou alteração; a propriedade deve ser validada em todas as operações.

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
*   **RN-014 — Movimentações: Elas são imutáveis, ou seja, caso sejam criadas, para serem alteradas devem ser excluídas e criadas novamente.**
*   **RN-015 — Lançamento recorrente:** cada combinação de recorrência e competência pode originar no máximo um lançamento.
*   **RN-016 — Estado inicial da recorrência:** lançamentos gerados automaticamente devem nascer como pendentes e somente afetar o saldo após confirmação.
*   **RN-017 — Alteração da recorrência:** alterar a regra de recorrência afeta apenas lançamentos futuros ainda não gerados; lançamentos já existentes preservam seu histórico.
*   **RN-018 — Encerramento da recorrência:** uma recorrência sem data final continua gerando lançamentos até ser desativada.

### Planejamento do salário
*   **RN-019 — Planejamento único:** cada usuário pode possuir somente um planejamento ativo por competência.
*   **RN-020 — Limite de distribuição:** a soma dos valores distribuídos não pode ultrapassar o valor-base do salário planejado.
*   **RN-021 — Valor não alocado:** o planejamento pode ser salvo com parte do salário ainda não distribuída, desde que essa diferença seja apresentada ao usuário.
*   **RN-022 — Percentuais:** os percentuais devem ser calculados sobre o valor-base do planejamento e recalculados quando esse valor for alterado.
*   **RN-023 — Realizado por destino:** o valor realizado de um destino corresponde às despesas confirmadas da competência vinculadas às categorias que o compõem.
*   **RN-024 — Competência fechada:** o planejamento não pode ser alterado enquanto a competência estiver fechada.

### Dashboard e fechamento mensal
*   **RN-025 — Totais realizados:** receitas, despesas e resultado realizado devem considerar somente movimentações confirmadas e não excluídas.
*   **RN-026 — Saldo projetado:** o saldo projetado corresponde ao saldo atual consolidado, acrescido das receitas pendentes e reduzido das despesas pendentes até o fim do período selecionado.
*   **RN-027 — Percentual utilizado:** o percentual de uso do salário corresponde às despesas confirmadas da competência divididas pelo valor-base do planejamento; na ausência de planejamento, o indicador não deve ser calculado.
*   **RN-028 — Comparação mensal:** comparações devem utilizar competências completas equivalentes e informar quando não houver dados suficientes no mês anterior.
*   **RN-029 — Pendências no fechamento:** ao fechar um mês com movimentações pendentes, o sistema deve alertar o usuário e exigir confirmação explícita; as pendências devem aparecer separadamente no resumo.
*   **RN-030 — Bloqueio após fechamento:** uma competência fechada é somente leitura e não aceita criação, edição, confirmação ou exclusão de movimentações.
*   **RN-031 — Reabertura:** somente o proprietário pode reabrir uma competência; a data e a hora da reabertura devem ser registradas.
*   **RN-032 — Novo fechamento:** ao reabrir uma competência, o resumo anterior deve ser invalidado e um novo resumo deve ser gerado no próximo fechamento.
*   **RN-033 — Moeda inicial:** o MVP opera exclusivamente em Real brasileiro (BRL); suporte a múltiplas moedas fica fora do escopo inicial.

## Contratos da API:
### 1\. Convenções HTTP
*   **Base URL:** todas as rotas públicas do MVP devem utilizar o prefixo `/api/v1`.
*   **Datas:** datas civis utilizam `YYYY-MM-DD`; competências utilizam `YYYY-MM`; timestamps utilizam ISO 8601 em UTC.
*   **Valores monetários:** valores entram e saem como strings decimais, por exemplo `"1250.50"`, e são convertidos para `Decimal` no backend.
*   **Moeda:** o MVP utiliza exclusivamente o código `BRL`.
*   **Identificadores:** recursos utilizam UUID e nunca expõem IDs incrementais internos.
*   **Autenticação:** access e refresh tokens são enviados por cookies seguros; tokens não são retornados no JSON.
*   **Idempotência:** operações automáticas e fechamento mensal devem possuir proteção contra processamento duplicado.
### 2\. Resposta de sucesso
Toda resposta com conteúdo deve seguir o envelope:

```json
{
  "data": {},
  "meta": {}
}
```

O campo **meta** é opcional e deve ser utilizado para paginação, filtros aplicados ou informações de agregação.
### 4\. Contrato de paginação
Rotas de listagem paginada devem aceitar **page**, **pageSize**, **sortBy** e **sortOrder** e responder:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

O valor padrão de **pageSize** é 20 e o limite máximo é 100.
### 6\. DTOs de entrada
#### Auth
*   **RegisterUserInput:** `name`, `email`, `password`.
*   **LoginInput:** `email`, `password`.
*   **ForgotPasswordInput:** `email`.
*   **ResetPasswordInput:** `token`, `newPassword`.

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

#### Salary plans
*   **UpsertSalaryPlanInput:** `competence`, `baseAmount`, `allocations`.
*   **SalaryAllocationInput:** `name`, `plannedAmount`, `categoryIds`.

O backend calcula **percentage**, **allocatedAmount** e **unallocatedAmount**; esses valores não são confiados ao cliente.

#### Recurring transactions
*   **CreateRecurringRuleInput:** `description`, `amount`, `type`, `accountId`, `categoryId`, `frequency`, `interval`, `startDate`, `endDate?`, `notes?`.
*   **UpdateRecurringRuleInput:** versão parcial dos campos editáveis.
*   **ChangeRecurringRuleStatusInput:** `isActive`.

Frequências iniciais: `WEEKLY`, `MONTHLY` e `YEARLY`. O campo **interval** deve ser um inteiro maior ou igual a 1.

#### Monthly closing
*   **CloseMonthInput:** `acknowledgePendingTransactions`.
*   **ReopenMonthInput:** `reason`.

### 7\. DTOs de saída
#### UserView
`id`, `name`, `email`, `createdAt`, `updatedAt`.

#### AccountView
`id`, `name`, `type`, `institution`, `initialBalance`, `currentBalance`, `projectedBalance`, `currency`, `color`, `icon`, `isActive`, `createdAt`, `updatedAt`.

#### CategoryView
`id`, `name`, `type`, `color`, `icon`, `isDefault`, `isActive`, `createdAt`, `updatedAt`.

#### TransactionView
`id`, `description`, `amount`, `type`, `status`, `transactionDate`, `competence`, `account`, `category`, `notes`, `recurringRuleId`, `createdAt`, `updatedAt`.

#### SalaryPlanView
`id`, `competence`, `baseAmount`, `allocatedAmount`, `unallocatedAmount`, `allocatedPercentage`, `allocations`, `createdAt`, `updatedAt`.

Cada alocação retorna `id`, `name`, `plannedAmount`, `realizedAmount`, `remainingAmount`, `percentage` e `categories`.

#### RecurringRuleView
`id`, `description`, `amount`, `type`, `account`, `category`, `frequency`, `interval`, `startDate`, `endDate`, `nextGenerationDate`, `isActive`, `createdAt`, `updatedAt`.

#### DashboardView
`competence`, `consolidatedBalance`, `projectedBalance`, `totalIncome`, `totalExpense`, `monthlyResult`, `salaryUsage`, `categoryBreakdown`, `upcomingTransactions`, `previousMonthComparison`, `salaryPlanProgress`.

#### MonthlyClosingView
`id`, `competence`, `status`, `totalIncome`, `totalExpense`, `savedAmount`, `pendingIncome`, `pendingExpense`, `planningDeviation`, `closedAt`, `reopenedAt`, `reopenReason`, `createdAt`, `updatedAt`.

### 8\. Contratos internos do backend
As interfaces pertencem à camada de aplicação ou domínio. Prisma, Redis, bcrypt e demais bibliotecas devem ser implementações substituíveis desses contratos.

#### Repositories
*   **UserRepository:** `findById`, `findByEmail`, `existsByEmail`, `create` .
*   **AccountRepository:** `findById`, `listByUser`, `create`, `update`, `changeStatus`, `getConsolidatedBalances`.
*   **CategoryRepository:** `findById`, `listByUser`, `findByNameAndType`, `create`, `update`, `changeStatus`.
*   **TransactionRepository:** `findById`, `listByFilters`, `create`, `update`, `softDelete`, `changeStatus`, `getMonthlySummary`, `getCategoryBreakdown`, `existsRecurringInstance`.
*   **SalaryPlanRepository:** `findByCompetence`, `listByUser`, `create`, `update`, `getProgress`.
*   **RecurringTransactionRepository:** `findById`, `listByUser`, `findDueRules`, `create`, `update`, `changeStatus`, `updateNextGenerationDate`.
*   **MonthlyClosingRepository:** `findByCompetence`, `listByUser`, `createSnapshot`, `close`, `reopen`, `isClosed`.

Todos os métodos devem receber o **userId** quando consultarem recursos privados.

#### Providers
*   **PasswordHasher:** `hash` e `compare`.
*   **SessionProvider:** `create`, `refresh`, `validate`, `revoke` e `revokeAllFromUser`.
*   **CacheProvider:** `get`, `set`, `delete` e `deleteByPattern`.
*   **ClockProvider:** `now` e operações determinísticas de competência.
*   **IdGenerator:** `generate`.
*   **UnitOfWork:** executa operações que exigem atomicidade dentro de uma transação de banco.

### 9\. Regras de retorno dos casos de uso
*   Casos de uso não devem retornar objetos do Prisma diretamente.
*   Sucessos retornam entidades ou DTOs da aplicação.
*   Falhas esperadas retornam erros de domínio tipados.
*   Um middleware global converte erros de domínio em códigos HTTP.
*   Erros inesperados são registrados com **requestId** e convertidos em **INTERNAL\_ERROR**.
*   Presenters removem campos internos e formatam datas e valores monetários para o contrato HTTP.

## Arquitetura, Padrões:

## Rotas da API:
Todas as rotas abaixo utilizam o prefixo **/api/v1**. A coluna “Auth” indica se a sessão autenticada é obrigatória.

### System

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/health` | Não | Estado básico da API — 200 |

### Auth Management

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| POST | `/auth/login` | Não | Autentica e inicia sessão — 200 |
| POST | `/auth/refresh` | Refresh cookie | Renova a sessão e rotaciona tokens — 204 |
| POST | `/auth/logout` | Sim | Revoga a sessão e remove cookies — 204 |
| GET | `/auth/me` | Sim | Retorna o usuário autenticado — 200 |

### Account Management

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/accounts` | Sim | Lista as contas e seus saldos — 200 |
| POST | `/accounts` | Sim | Cria uma conta — 201 |
| GET | `/accounts/:accountId` | Sim | Consulta uma conta — 200 |
| PATCH | `/accounts/:accountId` | Sim | Atualiza dados da conta — 200 |

### Category Management

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/categories` | Sim | Lista categorias; aceita filtro por `type` e `isActive` — 200 |
| POST | `/categories` | Sim | Cria uma categoria personalizada — 201 |
| GET | `/categories/:categoryId` | Sim | Consulta uma categoria — 200 |
| PATCH | `/categories/:categoryId` | Sim | Atualiza uma categoria personalizada — 200 |
| PATCH | `/categories/:categoryId/status` | Sim | Ativa ou desativa uma categoria — 200 |

### Transaction Management

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/transactions` | Sim | Lista com paginação e filtros — 200 |
| GET | `/transactions/:transactionId` | Sim | Consulta uma movimentação — 200 |
| POST | `/transactions` | Sim | Registra receita ou despesa — 201 |
| DELETE | `/transactions/:transactionId` | Sim | Realiza exclusão lógica — 204 |

Filtros previstos em **GET /transactions**: `competence`, `startDate`, `endDate`, `type`, `status`, `accountId`, `categoryId`, `search`, `page`, `pageSize`, `sortBy` e `sortOrder`.

### Salary Planning

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/salary-plans` | Sim | Lista o histórico de planejamentos — 200 |
| POST | `/salary-plans` | Sim | Cria o planejamento de uma competência — 201 |
| GET | `/salary-plans/:competence` | Sim | Consulta plano e progresso do mês — 200 |
| PATCH | `/salary-plans/:competence` | Sim | Atualiza salário-base ou alocações — 200 |

### Recurring Transaction Management

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/recurring-transactions` | Sim | Lista regras recorrentes — 200 |
| POST | `/recurring-transactions` | Sim | Cria uma regra recorrente — 201 |
| GET | `/recurring-transactions/:recurringId` | Sim | Consulta uma regra — 200 |
| PATCH | `/recurring-transactions/:recurringId` | Sim | Atualiza lançamentos futuros — 200 |
| PATCH | `/recurring-transactions/:recurringId/status` | Sim | Ativa ou desativa a regra — 200 |

O processamento das recorrências é executado por um scheduler interno que chama diretamente o caso de uso. Não deve existir uma rota pública sem proteção para disparar esse processamento.

### Dashboard & Financial Analytics

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/dashboard?competence=YYYY-MM` | Sim | Retorna indicadores e agregações do mês — 200 |

### Monthly Closing

| Método | Rota | Auth | Resultado |
| ---| ---| ---| --- |
| GET | `/monthly-closings` | Sim | Lista o histórico de competências fechadas — 200 |
| GET | `/monthly-closings/:competence/preview` | Sim | Gera a prévia atual do fechamento — 200 |
| GET | `/monthly-closings/:competence` | Sim | Consulta o snapshot e o estado da competência — 200 |
| POST | `/monthly-closings/:competence/close` | Sim | Confirma e registra o fechamento — 201 |
| POST | `/monthly-closings/:competence/reopen` | Sim | Reabre a competência e invalida o snapshot — 200 |

## Convencções:
*   Todo o projeto em inglês
*   Utilizazr gitflow. Toda no feature = Nova branch (ex: feature/nome)
*   Commits devem seguir regras de conventional commits ([https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/))
*   Classes, interfaces e types escritas em PascalCase
*   Nome de arquivos e pastas em kebab-case (backend)
*   funções e variáveis em camelCase
*   constantes globais em UPPER\_SNAKE\_CASE
## Funções dos serviços:
## Justificativa de decisões (perguntas / respostas):
Como pode ser feito o fechamento do mês automaticamente?
Como funciona o cadastro de receitas recorrentes? Como será retirado do salário automaticamente?
### Decisões:
## Aprendizado(s):

## **Anotações gerais/Lembretes:**