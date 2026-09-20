# Minha Carteira

Minha Carteira é uma aplicação web de gestão financeira pessoal. O projeto foi
criado como uma ferramenta de uso próprio e também como um projeto de estudo
Full Stack.

O MVP permite organizar contas financeiras, categorias, receitas, despesas e
movimentações recorrentes. O dashboard mensal apresenta os saldos, os totais de
receitas e despesas e a distribuição dos gastos por categoria.

## Escopo do MVP

- Acesso privado com credenciais configuradas;
- Cadastro, edição, desativação e reativação de contas financeiras;
- Cadastro, edição, desativação e reativação de categorias;
- Registro de receitas e despesas;
- Lançamentos pendentes ou confirmados;
- Receitas e despesas recorrentes;
- Dashboard mensal;
- Valores em Real brasileiro (BRL).

Funcionalidades como planejamento salarial, fechamento mensal, metas, grupos,
amizades, integrações bancárias e cadastro público de usuários ficam para etapas
posteriores.

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS e shadcn/ui;
- Backend: Node.js, Express e TypeScript;
- Banco de dados: PostgreSQL;
- ORM: Prisma;
- Gerenciador de pacotes: Yarn 4.

## Instalação

Clone o repositório e instale as dependências de cada aplicação:

```bash
git clone <URL_DO_REPOSITORIO>
cd minha-carteira

cd backend
yarn install

cd ../frontend
yarn install
```

Configure as variáveis de ambiente necessárias antes de conectar o backend ao
PostgreSQL. Os detalhes de configuração serão documentados conforme a
implementação da API avançar.

## Desenvolvimento do frontend

```bash
cd frontend
yarn dev
```

O frontend ficará disponível em `http://localhost:3000`.

Comandos disponíveis no frontend:

```bash
yarn build
yarn start
yarn lint
```

O backend ainda está em fase inicial de implementação e não possui scripts de
execução definidos no `package.json`.

## Documentação completa

Este README apresenta apenas uma visão geral do projeto. A documentação
completa, incluindo requisitos, regras de negócio, arquitetura, contratos da
API, fluxos e rotas, está disponível em:

[`docs/Gerenciador de Finanças - Minha Carteira.md`](docs/Gerenciador%20de%20Finan%C3%A7as%20-%20Minha%20Carteira.md)

Ao desenvolver uma nova funcionalidade, consulte esse arquivo para verificar o
escopo e as decisões técnicas atuais.
