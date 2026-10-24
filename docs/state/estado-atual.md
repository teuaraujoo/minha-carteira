# Estado atual e ponto de retomada

Registro de 22 de outubro de 2026, referente ao commit `727d98f`.

Este documento registra onde o trabalho parou. As specs vinculadas continuam
sendo a referência dos requisitos; este registro não aprova decisões pendentes
nem substitui seus critérios de aceitação.

## Onde paramos

A última entrega foi a simplificação da inicialização do backend, registrada
no commit `727d98f` — `refactor(server): simplify startup composition`.
A árvore de trabalho estava limpa antes da criação deste documento.

O próximo foco identificado na conversa é a autenticação no frontend. Isso não
significa que todas as tarefas do backend estejam encerradas: há validações
adiadas, processos agendados em backlog e registros de logs a reconciliar.
Nenhuma implementação dessas pendências foi iniciada nesta retomada.

## Última entrega: inicialização do servidor

- `server.ts` importa `createCompositionRoot` diretamente e a chama uma vez.
- O próprio `server.ts` abre a porta HTTP, registra falhas de inicialização e
  trata `SIGINT` e `SIGTERM` para encerrar servidor e logger.
- `start-server.ts` foi removido; não há mais `StartedServer`, função exportada
  `startServer` ou verificação de execução direta.
- `createApp` exige `logger`, `authRouter`, `usersRouter` e `allowedOrigins`.
  Os roteadores são montados sempre, sem opções alternativas automáticas.
- A composição exige `FRONTEND_ORIGINS` com ao menos uma entrada. Não usa
  `FRONTEND_URL` ou uma lista vazia como alternativa para essa configuração.
- O `notFoundHandler` foi mantido: ele encaminha o erro 404 ao middleware global,
  que produz a resposta padronizada. Rotas inexistentes não geram erro
  automaticamente no Express.
- A fixture `server-bootstrap.mjs` é exclusiva dos testes: substitui a composição
  para testar a inicialização sem carregar banco ou serviços externos.

Com o import direto, erros durante o carregamento dos módulos podem ocorrer
antes do `try` de `server.ts`. Por exemplo, a ausência de `DATABASE_URL` é
validada na importação do cliente Prisma. O `catch` trata falhas da chamada
à composição e da abertura síncrona do servidor, não essa fase de importação.

Referências: [servidor](../backend/src/server.ts),
[aplicação](../backend/src/app/app.ts),
[composição](../backend/src/app/compositon-root.ts) e
[testes de inicialização](../backend/test/logging/start-server.test.ts).

## Situação das specs

| Área | Estado registrado | O que falta |
| --- | --- | --- |
| Auth backend | Login, refresh, logout, recuperação e reativação implementados | Validações integradas adiadas; integração com frontend; expiração agendada em backlog |
| Users backend | Cadastro, perfil, imagem e ciclo de vida implementados | Validações HTTP/PostgreSQL adiadas; limpeza definitiva de inativos em backlog |
| Storage backend | Contratos, adapter R2 e integração por contexto implementados | STR-02 em andamento; STR-04/05 em revisão por validações adiadas |
| Logs | Fundação LOG-01 a LOG-05 aprovada no registro existente | LOG-06 a LOG-09 constam pendentes; reconciliar registro antigo com os serviços atuais |
| Auth frontend | Specs e tarefas definidas; páginas de autenticação não encontradas na árvore `frontend/app` consultada | Implementar e validar FE-AUTH-01 a FE-AUTH-08 |

A marcação de implementação nas specs não equivale à aprovação de integração
com PostgreSQL, envio real de e-mail ou uso em produção.

Referências: tarefas de [auth](../backend/.specs/features/auth/tasks.md),
[users](../backend/.specs/features/users/tasks.md),
[storage](../backend/.specs/features/storage/tasks.md),
[validação de logs](../backend/.specs/features/structured-logging/validation.md)
e [autenticação frontend](../frontend/.specs/features/auth-pages/tasks.md).

## Próxima frente: autenticação no frontend

A sequência prevista na spec é:

1. **FE-AUTH-01:** contratos, cliente HTTP, providers e estado de autenticação.
2. **FE-AUTH-02:** layout público e componentes compartilhados.
3. **FE-AUTH-03 a 06:** login, cadastro, solicitação de recuperação e nova senha.
4. **FE-AUTH-07:** proteção das rotas privadas, renovação de sessão e logout.
5. **FE-AUTH-08:** validação integrada, acessibilidade e documentação.

A integração de redirecionamento após recuperar a senha também aparece no
backend como **T14 / AUTH-13**; é parte dessa frente de frontend, não uma
segunda implementação independente.

Antes de executar cada tarefa afetada, reconciliar as decisões antigas da
spec frontend com os contratos atuais do backend. Já existem política de senha
mínima de oito caracteres para cadastro e redefinição, formato de celular
brasileiro com `+55`, nomes e atributos de cookies, validação CSRF e endpoint
`GET /api/v1/auth/me`. Esses itens exigem alinhamento da spec e integração,
não uma nova decisão sobre sua existência. A máscara visual do telefone ainda
precisa acompanhar o contrato aceito pela API.

Referências de implementação: [schema de usuários](../backend/src/modules/users/presentation/schemas/users.schemas.ts),
[schema de autenticação](../backend/src/modules/auth/presentation/schemas/auth.schemas.ts),
[cookies](../backend/src/modules/auth/presentation/security/auth-cookies.ts) e
[rotas de autenticação](../backend/src/modules/auth/presentation/routes/auth.routes.ts).

Confirmar as escolhas restantes de topologia frontend/API, organização da área
privada, retorno à URL originalmente solicitada e apresentação das páginas.

A proteção do token de recuperação também depende das configurações de cache,
referrer e logs do ambiente de hospedagem. Ferramentas novas de testes exigem
aprovação antes de instalar dependências.

Referências: [feature frontend](../frontend/.specs/features/auth-pages/feature.md),
[design frontend](../frontend/.specs/features/auth-pages/design.md) e
[design visual](../DESIGN.md).

## Backlog backend e validações adiadas

- **Users T10 / USR-07:** excluir em lotes contas elegíveis após 30 dias de
  desativação, coordenando a remoção dos dados e objetos associados. A rotina
  automática depende da futura definição de processos agendados.
- **Auth T16 / AUTH-15:** expirar solicitações e desafios vencidos, com
  idempotência, paginação e controle de concorrência. Depende de agendamento
  aprovado.
- **PostgreSQL:** validar persistência, constraints e cenários transacionais
  com banco configurado, conforme as pendências de cada módulo.
- **HTTP integrado:** concluir os cenários adiados de auth, users e storage.
- **Resend:** verificar envio real; adapter implementado e testes simulados
  não comprovam entrega externa.
- **Logs:** conferir LOG-06 a LOG-09 antes de abrir implementação. O registro
  antigo cita serviços ainda inexistentes na data da validação, e pode estar
  desatualizado frente aos módulos atuais.

Esses itens permanecem separados da próxima frente de frontend. Este documento
não autoriza migrations, instalação de dependências ou ativação de rotinas.

## Evidências e limites de verificação

- O histórico confirma o commit `727d98f`; não há commit de implementação
  posterior na consulta realizada para este registro.
- Na entrega anterior, os três testes de inicialização passaram após corrigir
  a fixture ausente e a quebra de linha do diagnóstico de erro.
- A compilação TypeScript e a suíte ampliada não foram concluídas naquela
  entrega: o Yarn 4.18.1 não estava disponível localmente e o download falhou.
- Essa limitação é histórica; a disponibilidade atual do Yarn não foi testada
  nesta atualização de documentação.
- Nesta atualização foram lidos specs, código de inicialização e estrutura do
  frontend. Não foram executados testes, build, migrations ou envio de e-mail.
- Não foi feita auditoria completa de aderência da implementação às specs.

## Como retomar

1. Ler FE-AUTH-01 e comparar seus contratos com as rotas e schemas atuais do
   backend, reconciliando as divergências antes de implementar a parte afetada.
2. Confirmar decisões realmente abertas com o usuário; não reapresentar como
   indefinidos os contratos já aprovados e implementados.
3. Implementar a tarefa autorizada e verificar os scripts existentes no pacote.
   No frontend há `lint` e `build`; usar Yarn 4 no diretório correspondente.
4. Registrar evidências das verificações e manter separados os itens adiados e
   o backlog de processos agendados.
5. Atualizar este registro quando o ponto de retomada mudar.
