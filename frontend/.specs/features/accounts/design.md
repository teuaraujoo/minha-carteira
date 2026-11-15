# Design técnico — telas de contas financeiras (`accounts`)

## Contexto atual

O shell privado (`AppShell`) em [app-shell.tsx](file:///c:/Users/teco0/Documents/GitHub/minha-carteira/frontend/components/app-shell.tsx) já fornece navegação, header fixo, alternância de tema claro/escuro sincronizada com os tokens em [globals.css](file:///c:/Users/teco0/Documents/GitHub/minha-carteira/frontend/app/globals.css) (`#012048`, `#015363`, `#00C7C4`, `#F8FAFC`, `#07111E`, `#0C192C`) e suporte WhatsApp.

Atualmente a rota [accounts/page.tsx](file:///c:/Users/teco0/Documents/GitHub/minha-carteira/frontend/app/accounts/page.tsx) contém apenas um placeholder dentro de `<AppShell>`, e ainda não existem a rota `/accounts/[accountId]`, os componentes de conta nem os serviços HTTP de `accounts`.

## Organização proposta

```text
frontend/
├── app/
│   └── accounts/
│       ├── page.tsx                 # Listagem Master-Detail (/accounts)
│       └── [accountId]/
│           └── page.tsx             # Detalhe completo da conta (/accounts/[accountId])
├── components/
│   └── accounts/
│       ├── account-catalog.ts       # Catálogo de bandeiras (brand), instituições, tipos e cores curadas
│       ├── account-wallet-card.tsx  # Card visual com bandeira, saldo, instituição, nome e notch opcional
│       ├── account-wallet-stack.tsx # Pilha interativa à esquerda + toggle Pilha/Grade
│       ├── account-preview-panel.tsx# Painel direito de prévia rápida em /accounts
│       ├── account-form-dialog.tsx  # Modal/drawer de criação e edição com preview ao vivo
│       └── account-detail-view.tsx  # KPIs, seletor de mês, gráficos e últimas transações
└── services/
    └── accounts/                    # (Etapa de integração API) contratos, mappers e chamadas HTTP
```

## Anatomia do card (`AccountWalletCard`)

Adaptação visual da referência de carteira empilhada para contas financeiras:

```text
+-------------------------------------------------------+
| [Logo Brand / Ícone Tipo]          [Tipo] ([Inativa]) | <- Faixa visível quando empilhada atrás
|                                                       |
| Saldo atual                        Instituição        |
| R$ 56.782,80                       Nubank / Itaú      |
|                                                       |
| Nome da conta               +-----------------------+ |
| Reserva Principal           |  (+) Nova conta       | | <- Recorte (notch) no card em destaque
+-----------------------------+-----------------------+ |
```

### Regras visuais do card

- **Bandeira (`brand`) vs Instituição (`institution`):**
  - Se `brand` corresponder a uma bandeira conhecida no catálogo (`visa`, `mastercard`, `elo`, `amex`, `hipercard`), renderiza o SVG/logotipo da bandeira no topo esquerdo com contraste adequado ao fundo do card.
  - Se `brand` for `null` ou não reconhecida, faz fallback para o ícone de `AccountType` (`CHECKING`, `CASH`, `DIGITAL`, `SAVINGS`, `INVESTMENT`).
  - `institution` aparece no bloco secundário à direita do saldo (ou omitida de forma limpa se `null`, exibindo opcionalmente o `initialBalance` resumido).
- **Cores e contraste:**
  - `color` aceita uma paleta curada (ex.: `#012048`, `#015363`, `#0F766E`, `#4F46E5`, `#7C3AED`, `#B45309`, `#1E293B`, `#00A3A1`) armazenada como hex `#RRGGBB`.
  - Função utilitária determina texto claro (`#FFFFFF`) ou escuro (`#0F172A`) por luminância caso venha um hex customizado.
- **Cartões de trás na pilha (`AccountWalletStack`):**
  - Exibem uma faixa superior clicável (`button` acessível com `aria-pressed` e foco visível) contendo o logotipo/ícone à esquerda e o nome da conta + tipo à direita.
  - Clicar ou pressionar `Enter`/`Espaço` em uma faixa traz a conta para a posição frontal (`selectedAccountId`) com transição suave respeitando `prefers-reduced-motion`.
  - Contas `INACTIVE` recebem aparência visual atenuada (opacidade reduzida / badge `Inativa`) e ficam separadas por filtro (`Ativas` por padrão, com opção `Inativas` ou `Todas`).

## Estrutura das telas

### 1. Tela `/accounts` (Master-Detail)

1. **Barra superior da página:**
   - Resumo consolidado: **Saldo total das contas ativas**, contagem (`X contas ativas • Y inativas`) e botão de privacidade para **ocultar/exibir valores** (`••••••`).
   - Controles à direita: filtro de status (`Ativas` / `Inativas` / `Todas`), alternador de visualização (`Pilha` / `Grade`) e ação primária `+ Nova conta` (acessível mesmo no modo Grade ou quando não houver contas).
2. **Área principal (`grid lg:grid-cols-[minmax(320px,420px)_1fr] gap-6`):**
   - **Coluna esquerda (Modo Pilha):** `AccountWalletStack` com as contas filtradas e o notch `+ Nova conta` integrado na base do card em foco. *(No Modo Grade, o grid expande em colunas responsivas de cards.)*
   - **Coluna direita (Prévia da conta selecionada):**
     - Cabeçalho com nome, tipo, instituição, bandeira e status;
     - Resumo rápido do mês corrente (`Entradas`, `Saídas` e `Saldo inicial`);
     - Lista resumida das **últimas 3–5 movimentações** da conta selecionada;
     - Ações rápidas: **`Ver detalhes completos`** (navega para `/accounts/[accountId]`), **`+ Nova movimentação`** e **`Editar`**.

### 2. Tela `/accounts/[accountId]` (Detalhe completo)

1. **Cabeçalho e contexto:**
   - Breadcrumb (`Contas / <Nome da conta>`) e badge de status (`Ativa` / `Inativa`).
   - Ações: **`+ Nova movimentação`** (pré-preenche `accountId`), **`Editar`**, **`Desativar / Reativar`** e **`Excluir`** (desabilitado com explicação caso já possua movimentações vinculadas).
   - Se `status === "INACTIVE"`, exibe alerta no topo explicando que a conta não compõe o saldo total consolidado e aceita apenas consulta de histórico.
2. **Seletor de competência (`YYYY-MM`):**
   - Navegação `< Mês Ano >` controlando os KPIs mensais, o gráfico de gastos por categoria e o recorte do período.
3. **Faixa de KPIs:**
   - `Saldo atual` (`currentBalance`, destaque principal);
   - `Saldo inicial` (`initialBalance`);
   - `Entradas do mês` (confirmadas);
   - `Saídas do mês` (confirmadas) + `Resultado do mês`;
   - Indicador secundário de `Movimentações pendentes` no período/conta.
4. **Bloco analítico (2 colunas em `lg+`):**
   - **Gráfico de Entradas vs Saídas (últimos 6 meses):** barras comparativas mensais para acompanhar tendência da conta.
   - **Gastos por categoria (mês selecionado):** distribuição percentual e em `R$` por categoria de despesa (`EXPENSE`), ordenada do maior para o menor gasto, permitindo identificar rapidamente onde o dinheiro daquela conta está saindo.
5. **Últimas transações da conta:**
   - Tabela/lista responsiva com as movimentações mais recentes (data, descrição, categoria com cor/ícone, badge `Confirmada`/`Pendente`, valor) e link **`Ver todas`** levando para `/transactions?accountId=<id>`.

## Estados e acessibilidade

- **Estado vazio:** quando o usuário não possuir contas cadastradas, exibe CTA claro para criar a primeira conta mantendo o preview do card como guia visual.
- **Acessibilidade:** faixas empilhadas operáveis por teclado (`Tab`, `Enter`, `Espaço`), suporte a `prefers-reduced-motion` nas animações de troca de card, e rótulos `aria-label` nos botões de ocultar saldo e ações de ciclo de vida.
- **Privacidade:** ao ocultar valores, todos os saldos da página ficam mascarados no cliente de forma consistente.
