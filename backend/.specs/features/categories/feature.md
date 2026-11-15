# Módulo de categorias financeiras (`categories`)

> **Status da spec:** Aprovada e finalizada para implementação do módulo `categories` no backend.

## Objetivo

Permitir o gerenciamento de categorias financeiras para classificar receitas e despesas em `transactions`, combinando **categorias padrão do sistema** (globais, inseridas via seed) e **categorias personalizadas por usuário**, com controle de status (`ACTIVE`/`INACTIVE`), cor e ícone opcionais, isolamento estrito por usuário e integridade referencial no PostgreSQL.

## Escopo

### Incluído nesta etapa (`categories`)

- Modelagem da tabela `categories` e do enum `CategoryStatus` (`ACTIVE`, `INACTIVE`) no PostgreSQL via Prisma;
- Seed das categorias padrão do sistema (`isDefault = true`, `userId = null`) alinhadas às categorias já utilizadas no frontend;
- Camadas do módulo `backend/src/modules/categories/` seguindo o padrão modular de `accounts` (`domain`, `application`, `infrastructure`, `presentation`);
- Operações HTTP versionadas sob `/api/v1/categories`:
  - Listar categorias disponíveis ao usuário (padrão do sistema + personalizadas do usuário autenticado, com filtro por `status` e busca por nome);
  - Criar categoria personalizada (`POST /api/v1/categories`);
  - Buscar categoria por ID (`GET /api/v1/categories/:categoryId`);
  - Atualizar categoria personalizada (`PATCH /api/v1/categories/:categoryId`);
  - Desativar e reativar categoria personalizada (`PATCH /api/v1/categories/:categoryId/deactivate` e `/reactivate`);
  - Excluir categoria personalizada fisicamente apenas quando não houver transações vinculadas (`DELETE /api/v1/categories/:categoryId`).

### Fora do escopo desta etapa

- Separação por tipo (`INCOME` / `EXPENSE`) na tabela `categories` — categorias são agnósticas de tipo;
- Exclusão lógica via `deletedAt` — o ciclo de vida usa apenas `status` (`ACTIVE` | `INACTIVE`);
- Alteração ou exclusão de categorias padrão do sistema (`isDefault = true`) por usuários finais via API.

## Decisões confirmadas

1. **Categorias sem `type`:**
   - A tabela `categories` **não** possui coluna `type` (`INCOME`/`EXPENSE`). Uma categoria pode ser usada livremente em qualquer lançamento de `transactions`.
2. **Categorias padrão (`isDefault`) + personalizadas (`userId`):**
   - `userId` é opcional (`@db.Uuid?`):
     - **Padrão do sistema:** `userId = null` e `isDefault = true` (visíveis para todos os usuários, populadas via seed).
     - **Personalizadas:** `userId = <id do usuário>` e `isDefault = false` (visíveis e gerenciáveis apenas pelo usuário dono).
3. **Ciclo de vida apenas com `status` (sem `deletedAt`):**
   - `status`: `CategoryStatus` (`ACTIVE` | `INACTIVE`), com padrão `ACTIVE`.
   - Não há coluna `deletedAt`. Categorias com transações vinculadas podem ser inativadas (`INACTIVE`) para preservar o histórico em `transactions`, e exclusão física só é permitida para categorias personalizadas sem vínculos.
4. **Identidade visual (`color` e `icon`):**
   - `color`: opcional (`String? @db.VarChar(7)`), validado no formato hexadecimal `#RRGGBB` (mesmo padrão de `accounts.color`).
   - `icon`: opcional (`String? @db.VarChar(40)`), chave textual curta para resolução de ícone no frontend.
5. **Unicidade de nome:**
   - Um usuário não pode criar duas categorias personalizadas com o mesmo nome normalizado (`trim()` e case-insensitive), nem duplicar o nome de uma categoria padrão ativa do sistema.
6. **Segurança e contratos globais:**
   - Autenticação via `createAuthenticationMiddleware`, proteção CSRF via `createCsrfValidationMiddleware` e isolamento estrito por `userId` (categorias `isDefault = true` são somente leitura para usuários comuns).
   - Reutilização integral de `pagination.ts`, `success-response.ts` e `app-error.ts`.

## Critérios de aceite (para a etapa de implementação)

- [ ] Schema Prisma, migration (`UP`/`DOWN`) e seed das categorias padrão válidos.
- [ ] Camada de domínio pura sem dependências de Prisma ou Express.
- [ ] Usuários não conseguem editar, inativar ou excluir categorias padrão (`isDefault = true`) nem categorias de outro usuário (anti-IDOR).
- [ ] Listagem retorna categorias padrão do sistema e personalizadas do usuário autenticado.
- [ ] Exclusão física bloqueada (`409 Conflict`) quando houver transações vinculadas.
