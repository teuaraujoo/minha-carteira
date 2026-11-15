<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="/frontend/public/logo.png">
    <img alt="Símbolo Minha Carteira" src="/frontend/public/logo.png" width="220" height="80">
  </picture>
</p>

<p align="center">
  <a href="https://nextjs.org/">
    <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat&logo=next.js&logoColor=white" alt="Next.js">
  </a>
  <a href="https://www.typescriptlang.org/">
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  </a>
  <a href="https://expressjs.com/">
    <img src="https://img.shields.io/badge/Express.js-5-000000?style=flat&logo=express&logoColor=white" alt="Express">
  </a>
  <a href="https://www.postgresql.org/">
    <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-blue?style=flat" alt="MIT License">
  </a>
</p>


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
