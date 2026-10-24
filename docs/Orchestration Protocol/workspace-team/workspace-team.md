# Workspace de Desenvolvimento Web - Estrutura de Agentes

Este documento descreve a orquestração, atribuição de modelos e a divisão de papéis no workspace de desenvolvimento do projeto **Minha Carteira**.

---

## 1. Orquestrador (Líder da Equipe)
- **Agente / Preset:** Antigravity
- **Modelo Alocado:** Gemini 3.6 Flash (Medium)
- **Função:** Gerenciamento geral do ciclo de vida do desenvolvimento, atendimento às solicitações do usuário, alocação de tarefas para subagentes/terminais, mediação de comunicação e consolidação de resultados.

---

## 2. Programador Backend
- **Identificador de Terminal:** `Backend-Dev`
- **Preset:** Codex
- **Modelo Alocado:** GPT 6 Sol High
- **Stack & Escopo:** Node.js, Express, TypeScript, PostgreSQL, Prisma, JWT, Bcrypt, CORS, Helmet em `backend/src`.
- **Responsabilidades:**
  - Desenvolvimento de APIs RESTful tipadas e seguras.
  - Implementação de use cases, middlewares e persistência de dados.
  - Manutenção de validações rígidas com Zod e padrões de erros centralizados.
  - Seguir convenções de nomenclatura em `kebab-case` para arquivos do backend.

---

## 3. Programador Frontend
- **Identificador de Terminal:** `Frontend-Dev`
- **Preset:** Codex
- **Modelo Alocado:** GPT 6 Sol Medium
- **Stack & Escopo:** Next.js (App Router), TypeScript, Tailwind CSS, `shadcn/ui`, `react-hook-form`, Zod em `frontend/src`.
- **Responsabilidades:**
  - Construção de interfaces de usuário acessíveis, responsivas e modernas.
  - Integração com endpoints da API backend.
  - Validação de formulários e gerenciamento de estado local/componentizado.

---

## 4. Planejador / Arquiteto
- **Identificador de Terminal:** `Planner-Agent`
- **Preset:** Codex
- **Modelo Alocado:** GPT 5.6 Luna Medium
- **Stack & Escopo:** Análise de requisitos, modelagem de domínio, documentação técnica em `docs/`.
- **Responsabilidades:**
  - Quebra de requisitos em fluxos detalhados: *input*, *validação*, *use case*, *módulo*, *persistência* e *resposta*.
  - Atualização e manutenção de especificações e documentação para desenvolvedores.
  - Garantia de alinhamento com o escopo do MVP.

---

## 5. Git Manager
- **Identificador de Terminal:** `Git-Manager`
- **Preset:** Antigravity
- **Modelo Alocado:** Gemini 3.6 Flash Medium
- **Stack & Escopo:** Git, Gitflow, Conventional Commits.
- **Responsabilidades:**
  - Garantir o fluxo de branches (`feature/nome-da-feature`).
  - Validar se as mensagens de commit seguem o padrão **Conventional Commits** em inglês.
  - Garantir a proteção da branch `main` (impedindo pushes diretos).
