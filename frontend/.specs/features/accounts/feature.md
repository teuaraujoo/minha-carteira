# Telas de contas financeiras (`accounts`)

> **Status da spec:** Estrutura de UI e decisões visuais aprovadas pelo usuário. Integração HTTP com o backend permanece dependente da definição final das rotas e DTOs de `accounts`, `transactions` e analytics.

## Objetivo

Definir a experiência e a arquitetura visual do módulo de contas no frontend (`Minha Carteira`), permitindo visualizar contas em formato de carteira empilhada interativa, inspecionar uma prévia rápida na própria listagem e acessar a visão detalhada de cada conta com indicadores, gráficos mensais, gastos por categoria e últimas movimentações.

## Resultado esperado

- Exibir as contas do usuário em uma carteira empilhada interativa inspirada em cartões físicos, adaptada semanticamente para contas financeiras;
- Diferenciar claramente **bandeira** (`brand`, opcional) de **instituição** (`institution`, opcional) e **tipo da conta** (`type`);
- Apresentar na rota `/accounts` o saldo total consolidado das contas ativas e o layout **Master-Detail** no desktop (pilha à esquerda + prévia da conta selecionada à direita);
- Permitir alternância entre visualização em **Pilha (Carteira)** e **Grade (Cards)**, além de filtro entre contas **Ativas** e **Inativas** e botão para ocultar/exibir valores;
- Oferecer criação e edição de contas com **paleta curada de cores** e **preview ao vivo do card**;
- Apresentar na rota `/accounts/[accountId]` a visão detalhada da conta com saldo atual, saldo inicial, entradas/saídas/resultado do mês, movimentações pendentes, seletor de competência (`YYYY-MM`), gráfico comparativo de entradas vs saídas, **gastos por categoria**, últimas transações e ações de ciclo de vida.

## Rotas da feature

| Rota | Finalidade | Acesso |
| --- | --- | --- |
| `/accounts` | Listagem em carteira empilhada, resumo consolidado e prévia rápida da conta selecionada | Privado (`AppShell`) |
| `/accounts/[accountId]` | Detalhes da conta, KPIs, gráficos mensais, gastos por categoria, últimas movimentações e gestão de status | Privado (`AppShell`) |

## Escopo

### Incluído

- Resumo consolidado no topo de `/accounts` (saldo total das contas `ACTIVE` e contagem de contas ativas/inativas);
- Toggle de privacidade para ocultar/exibir saldos na interface;
- Pilha interativa de cards à esquerda + prévia da conta selecionada à direita no desktop (`Master-Detail`), com botão fixo `+ Nova conta` no recorte inferior direito do card em destaque;
- Modo alternativo de visualização em grade e filtro por status (`ACTIVE` / `INACTIVE`);
- Catálogo visual no frontend para seleção de **bandeira** (`brand`) e **instituição** (`institution`), com fallback por `AccountType` quando opcionais forem `null`;
- Paleta curada de cores com garantia de contraste para texto no card e preview ao vivo no formulário;
- Página `/accounts/[accountId]` com KPIs (`currentBalance`, `initialBalance`, entradas, saídas, resultado do mês e resumo de pendentes), seletor de mês/competência (`YYYY-MM`), gráfico de entradas vs saídas (últimos 6 meses), distribuição de **gastos por categoria** no mês, últimas 5–10 transações com link `"Ver todas"` para `/transactions?accountId=...` e ações de ciclo de vida (`+ Nova movimentação`, editar, desativar/reativar e excluir quando sem histórico).

### Fora do escopo (MVP)

- Gestão de fatura de cartão de crédito, limite de crédito ou data de vencimento/fechamento;
- Número real ou mascarado de cartão e data de validade (`Exp. Date`);
- Conexão bancária automática (Open Finance) ou sincronização automática de saldos;
- Múltiplas moedas (exibição exclusivamente em `BRL` / `R$`).

## Decisões de UI aprovadas

1. **Adaptação semântica do layout de cartão para conta financeira:**
   - A estética da pilha de cartões é preservada sem simular dados fictícios de cartão (`Exp. Date`, `•••• 7845`).
   - Cada card exibe: ícone/logo da **bandeira** (`brand`) ou fallback do tipo no topo esquerdo; badge de `type` (e selo `Inativa` se `INACTIVE`) no topo direito; rótulo `"Saldo atual"` + `currentBalance` no centro esquerdo; nome da **instituição** (`institution`) ou referência de saldo inicial no centro direito; `name` da conta na base esquerda; e recorte inferior direito (notch) com botão `+ Nova conta` no card em foco.
2. **Separação explícita entre `brand` e `institution`:**
   - `brand` (opcional) representa exclusivamente a **bandeira** (ex.: Visa, Mastercard, Elo, etc.), determinando a imagem/logotipo principal no canto superior esquerdo do card quando informada.
   - `institution` (opcional) representa a **instituição financeira/banco** (ex.: Nubank, Itaú, Inter, Mercado Pago, etc.).
   - Quando `brand` não for informada (ex.: conta `CASH` ou conta corrente sem bandeira), o card faz fallback elegante para um ícone coerente com `type`.
3. **Layout Master-Detail em `/accounts`:**
   - No desktop (`lg+`), a coluna esquerda apresenta a **pilha interativa** e a coluna direita exibe a **prévia da conta selecionada** (resumo mensal, últimas transações e botão `"Abrir detalhes"` para `/accounts/[accountId]`).
   - No mobile, selecionar/tocar no card em foco abre `/accounts/[accountId]`.
   - O usuário também pode alternar para visualização em grade quando tiver muitas contas e filtrar entre contas ativas e inativas.
4. **Paleta curada de cores e preview no formulário:**
   - `color` utiliza paleta curada de cores com contraste validado (alinhada à identidade `#012048`, `#015363`, `#00C7C4` e variações seguras), com cálculo automático de contraste de texto e preview ao vivo do card durante criação/edição.
5. **Visão completa da conta em `/accounts/[accountId]`:**
   - Faixa de KPIs: `Saldo atual`, `Saldo inicial`, `Entradas do mês`, `Saídas do mês`, `Resultado do mês` e contador/total de `Movimentações pendentes`.
   - Seletor de competência (`YYYY-MM`) para navegação histórica mensal.
   - Dois gráficos complementares: **Entradas vs Saídas (últimos 6 meses)** e **Gastos por categoria** da conta no mês selecionado.
   - Lista de **últimas transações** na conta com data, categoria, status (`Confirmada`/`Pendente`), valor colorido e link `"Ver todas"` para `/transactions?accountId=...`.
   - Ações rápidas no cabeçalho (`+ Nova movimentação`, Editar, Desativar/Reativar, Excluir com bloqueio explicativo se houver lançamentos) e banner informativo quando `status === INACTIVE`.

## Dependências e pontos pendentes

- **Contratos HTTP do backend (`Aguardando definição`):** endpoints de listagem, detalhe da conta, resumo mensal / série de 6 meses, breakdown de gastos por categoria da conta e ações de criação/edição/status/exclusão.
- **Biblioteca de visualização de gráficos (`Aguardando resposta antes de instalar`):** confirmar qual abordagem será usada nos gráficos de `/accounts/[accountId]` (SVG/HTML nativo leve ou dependência como Recharts, mediante aprovação prévia conforme `AGENTS.md`).
