# Specs do backend

## Estrutura obrigatória de todas as specs

Toda especificação de funcionalidade (`.specs/features/<nome-da-feature>/`) **deve** conter obrigatoriamente **3 arquivos**:

1. `feature.md` — visão de negócio, escopo funcional, decisões confirmadas/pendentes e critérios de aceite.
2. `sdd.md` — desenho técnico (Software Design Document), arquitetura, fluxos (entrada, validação, caso de uso, módulos, persistência e resposta), contratos e SQL/schemas.
3. `tasks.md` — plano de execução passo a passo seguindo estritamente o template abaixo.

### Padrão obrigatório para o arquivo `tasks.md`

```markdown
# <Título>

## Objetivo
<Descrição clara do objetivo da entrega>

## Restrições globais
- <Restrição 1>
- <Restrição 2>

## Pontos de atenção
- <Ponto de atenção, se houver>

---

## Task 1: <Título da Task>

**Arquivos:**
- Modificar:
  - `caminho/do/arquivo.ts`
- Criar:
  - `caminho/do/novo.arquivo.ts`

**Passos:**
- [ ] Passo 1
- [ ] Passo 2

**Pronto quando:**
- <Critério objetivo de conclusão e verificação>

**Commit sugerido:**
`feat(escopo): mensagem em ingles no padrao conventional commits`
```

### Regra obrigatória para todas as migrations (`_prisma_migrations` + UP e DOWN)

Como nem sempre as migrations são executadas via CLI do Prisma (podendo ser aplicadas diretamente por query SQL no banco de dados), **toda migration criada deve obrigatoriamente conter**:

1. **UP (`migration.sql`):**
   - As instruções DDL/DML de aplicação da migration dentro de uma transação (`BEGIN; ... COMMIT;`).
   - Um `INSERT` idempotente na tabela `_prisma_migrations` registrando a aplicação da migration caso a tabela exista e o `migration_name` ainda não esteja registrado como aplicado (`rolled_back_at IS NULL`).
2. **DOWN (`down.sql` na mesma pasta + referência comentada ao final de `migration.sql`):**
   - As instruções SQL exatas de reversão da migration.
   - A remoção/atualização correspondente na tabela `_prisma_migrations` (`DELETE FROM "_prisma_migrations" WHERE "migration_name" = '<nome_da_migration>';`).

**Exemplo padrão de registro em `_prisma_migrations` (no UP):**
```sql
INSERT INTO "_prisma_migrations" (
  "id",
  "checksum",
  "finished_at",
  "migration_name",
  "logs",
  "rolled_back_at",
  "started_at",
  "applied_steps_count"
)
SELECT
  gen_random_uuid()::text,
  'manual_sql_<nome_da_migration>',
  NOW(),
  '<nome_da_migration>',
  NULL,
  NULL,
  NOW(),
  1
WHERE to_regclass('public._prisma_migrations') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "_prisma_migrations"
    WHERE "migration_name" = '<nome_da_migration>'
      AND "rolled_back_at" IS NULL
  );
```

3. **Atualização obrigatória dos scripts de Seed e Reset:**
   - Toda vez que uma alteração incluir criação ou modificação de **migration** (novas tabelas, colunas, constraints, tipos `ENUM` ou renomeações), é **obrigatório atualizar os scripts existentes de seed e de reset** (`backend/scripts/lib/staging.seed.ts`, `backend/scripts/seed.staging.ts`, `backend/scripts/lib/database.reset.ts` e `backend/scripts/reset.database.ts`) para refletir o novo schema.
   - Os scripts de seed e reset operam com base nas variáveis de conexão definidas no `.env` (`DATABASE_URL`, mantendo suporte a `STAGING_DATABASE_URL`), não sendo restritos apenas a staging.


## Como trabalhar

- Ler AGENTS.md e a spec; perguntar diante de dúvidas/decisões novas.
- Não pedir de novo confirmação já concedida; marcar decisões reais como
  **Aguardando resposta** e não tratar propostas como aprovações.
- Documentar antes do código e atualizar docs principais por implementação.
- Verificar critérios pertinentes, registrar limitações e evidências.