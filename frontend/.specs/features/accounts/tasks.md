# Telas de contas financeiras (`accounts`) — Plano de tarefas

## Objetivo
Planejar a construção incremental da interface do módulo de contas (`/accounts` e `/accounts/[accountId]`), começando pela estrutura visual e interativa em componentes desacoplados dos mocks e preparando a integração posterior com a API do backend.

## Restrições globais
- Seguir os tokens visuais definidos em `frontend/app/globals.css` (temas claro e escuro alinhados à marca `#012048`, `#015363`, `#00C7C4`).
- Respeitar `AGENTS.md`: textos de UI e comentários em português brasileiro; identificadores de código em inglês; utilizar Yarn 4 em `frontend/`.
- Não instalar novas bibliotecas (ex.: biblioteca de gráficos ou ícones extras) sem confirmação prévia.
- Não simular chamadas reais nem persistência fictícia como se fossem endpoints integrados quando ainda forem dados de protótipo/mock local.

## Pontos de atenção
- Os cards devem separar claramente `brand` (bandeira, opcional) de `institution` (banco/instituição, opcional) e `type` (`AccountType`), com fallback visual quando opcionais forem nulos.
- Contas `INACTIVE` não podem sugerir exclusão física quando possuírem lançamentos vinculados; a UI deve refletir a regra de desativação e preservação do histórico.
- A integração HTTP real depende do fechamento dos contratos de `accounts`, `transactions` e analytics no backend.

---

## Task 1: Catálogo de bandeiras, instituições, tipos e paleta de cores

**Arquivos:**
- Criar:
  - `frontend/components/accounts/account-catalog.ts`

**Passos:**
- [ ] Definir os metadados visuais de `AccountType` (`CHECKING`, `CASH`, `DIGITAL`, `SAVINGS`, `INVESTMENT`) com rótulo em português e ícone padrão (`lucide-react`).
- [ ] Definir o catálogo inicial de bandeiras (`brand`: ex. Visa, Mastercard, Elo, Amex, Hipercard) com SVG/badge próprio e helper de resolução com fallback seguro.
- [ ] Definir sugestões comuns de `institution` (Nubank, Itaú, Inter, Santander, Bradesco, Banco do Brasil, Caixa, C6, Mercado Pago, etc.) aceitando valor opcional/personalizado.
- [ ] Definir a paleta curada de cores (`color`) compatível com tema claro/escuro e helper de cálculo de contraste para texto no card.

**Pronto quando:**
- Catálogo e helpers tipados compilam sem erros (`yarn tsc --noEmit`) e cobrem casos com `brand`, `institution` e `color` nulos.

**Commit sugerido:**
`feat(frontend): add accounts visual catalog and color palette helpers`

---

## Task 2: `AccountWalletCard` e pilha interativa (`AccountWalletStack`)

**Arquivos:**
- Criar:
  - `frontend/components/accounts/account-wallet-card.tsx`
  - `frontend/components/accounts/account-wallet-stack.tsx`

**Passos:**
- [ ] Implementar `AccountWalletCard` com visual inspirado na carteira empilhada: topo com bandeira/fallback + tipo/status, centro com saldo atual (suportando máscara de privacidade) + instituição, base com nome da conta e recorte inferior direito (notch) opcional para `+ Nova conta`.
- [ ] Implementar `AccountWalletStack` permitindo selecionar qualquer conta de trás pela faixa superior para trazê-la à frente com transição suave (`motion-reduce` suportado) e navegação completa por teclado.
- [ ] Adicionar suporte a estado `INACTIVE` e modo alternativo em grade responsiva para fácil comparação quando houver muitas contas.

**Pronto quando:**
- Pilha e modo grade respondem corretamente em desktop e mobile, com foco e contraste adequados nos temas claro e escuro.

**Commit sugerido:**
`feat(frontend): create interactive account wallet card and stack components`

---

## Task 3: Página `/accounts` com layout Master-Detail e resumo consolidado

**Arquivos:**
- Criar:
  - `frontend/components/accounts/account-preview-panel.tsx`
- Modificar:
  - `frontend/app/accounts/page.tsx`

**Passos:**
- [ ] Implementar barra superior em `/accounts` com saldo total consolidado das contas ativas, contador de ativas/inativas, botão ocultar/exibir saldos, filtro de status (`Ativas`/`Inativas`/`Todas`) e alternador `Pilha`/`Grade`.
- [ ] Implementar `AccountPreviewPanel` na coluna direita no desktop exibindo resumo rápido, últimas movimentações da conta selecionada e ações (`Ver detalhes completos`, `+ Nova movimentação`, `Editar`).
- [ ] Garantir que, no mobile, o toque no card em destaque navegue para `/accounts/[accountId]` e que o estado vazio oriente a criação da primeira conta.

**Pronto quando:**
- `/accounts` renderiza o layout Master-Detail em `yarn build` e `yarn lint` sem erros.

**Commit sugerido:**
`feat(frontend): build accounts overview page with master-detail preview`

---

## Task 4: Formulário de criação/edição de conta com preview ao vivo

**Arquivos:**
- Criar:
  - `frontend/components/accounts/account-form-dialog.tsx`

**Passos:**
- [ ] Criar formulário com `react-hook-form` + `zod` cobrindo `name`, `type`, `initialBalance`, `brand?`, `institution?` e `color?` (paleta curada).
- [ ] Exibir preview em tempo real de `AccountWalletCard` conforme o usuário escolhe cor, bandeira, instituição e saldo inicial.
- [ ] Validar entradas em português brasileiro e adaptar campos editáveis no modo edição.

**Pronto quando:**
- Criação e edição validam corretamente no formulário com preview atualizado em tempo real.

**Commit sugerido:**
`feat(frontend): add account create and edit dialog with live card preview`

---

## Task 5: Página de detalhes `/accounts/[accountId]`

**Arquivos:**
- Criar:
  - `frontend/components/accounts/account-detail-view.tsx`
  - `frontend/app/accounts/[accountId]/page.tsx`

**Passos:**
- [ ] Implementar cabeçalho com breadcrumb, badge de status, banner informativo para conta `INACTIVE` e ações rápidas (`+ Nova movimentação`, Editar, Desativar/Reativar, Excluir).
- [ ] Implementar seletor de competência (`YYYY-MM`) e faixa de KPIs (`Saldo atual`, `Saldo inicial`, `Entradas do mês`, `Saídas do mês`, `Resultado do mês` e `Movimentações pendentes`).
- [ ] Implementar seção analítica com gráfico de **Entradas vs Saídas (últimos 6 meses)** e painel/gráfico de **Gastos por categoria** no mês selecionado.
- [ ] Implementar lista das últimas movimentações da conta com status (`Confirmada`/`Pendente`), categoria e link `"Ver todas"` para `/transactions?accountId=...`.

**Pronto quando:**
- `/accounts/[accountId]` compila e apresenta todos os blocos previstos nos temas claro e escuro, em desktop e mobile.

**Commit sugerido:**
`feat(frontend): implement account detail page with analytics and transactions`

---

## Task 6: Integração com a API do backend (após definição dos contratos)

**Arquivos:**
- Criar:
  - `frontend/services/accounts/` *(arquivos conforme contrato HTTP aprovado)*
- Modificar:
  - `frontend/app/accounts/page.tsx`
  - `frontend/app/accounts/[accountId]/page.tsx`
  - `frontend/components/accounts/account-form-dialog.tsx`

**Passos:**
- [ ] Alinhar DTOs e endpoints com a spec final do backend (`/api/v1/accounts*`, resumo mensal e breakdown por categoria).
- [ ] Substituir dados de protótipo por chamadas reais via `fetch` com cookies (`credentials: "include"`), CSRF e tratamento padronizado de erros (`AppError`).
- [ ] Executar `yarn lint`, `yarn tsc --noEmit` e `yarn build` em `frontend/` e validar estados de carregamento, erro e atualização de saldo após mutações.

**Pronto quando:**
- Fluxos de listagem, detalhe, criação, edição e mudança de status operam ponta a ponta com o backend e passam nas verificações de lint, tipos e build.

**Commit sugerido:**
`feat(frontend): integrate accounts pages with backend api`
