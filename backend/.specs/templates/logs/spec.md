# Spec portátil — logs estruturados internos

## Objetivo e limites

Facilitar debug, diagnóstico de falhas e correlação das etapas de uma operação.
Substituir console.log/error em fluxos de aplicação por uma interface tipada.
Não alterar regras de negócio, resultados, status, corpos ou headers HTTP.
Não criar tabela, migration, arquivo obrigatório ou provedor remoto para logs.
Saída do processo não é trilha de auditoria durável nem fonte de faturamento.

Entregar fundação e adoção nos services separadamente, com testes/evidências
por fase. Se commits forem autorizados no destino, usar dois commits distintos;
se não forem, preservar a separação lógica e as regras locais de entrega.

## Biblioteca e adaptação

A referência Node/TypeScript utiliza Pino e pino-http; pino-pretty é restrito
ao desenvolvimento. AsyncLocalStorage propaga contexto sem passar Request do
Express aos services. Outro framework/linguagem pode usar equivalentes,
preservando formato, isolamento e política de dados; não instalar Express
só para seguir esta spec.

Versões fixadas na origem: pino 10.4.0, pino-http 11.0.0 e pino-pretty 13.2.0.
Não são uma declaração de versões mais recentes nem autorização de instalação
no destino. Conferir runtime/dependências/logger existente e pedir aprovação
local quando necessária. Evitar dois middlewares emitindo o mesmo evento.

## Contrato de saída

Em produção/homologação, emitir um objeto JSON por linha (NDJSON).
Configurar o adapter: o formato padrão da biblioteca não é este contrato.

| Campo | Regra |
| --- | --- |
| timestamp | Gerado pelo logger, UTC ISO 8601, por exemplo 2026-10-13T12:00:00.000Z |
| level | Texto: debug, info, warn, error ou fatal |
| event | Identificador estável em inglês, sem valores sensíveis embutidos |
| module | Área responsável; catálogo tipado aprovado no projeto destino |
| message | Texto legível em português, sanitizado |
| requestId | UUID interno nos registros vinculados ao ciclo HTTP; ausente fora dele |
| context | Opcional; somente campos explicitamente permitidos e tipados |
| http | Opcional; exatamente method, route e statusCode no contrato atual |
| error | Opcional; diagnóstico sanitizado da falha, inclusive stack/causa |

Não acrescentar automaticamente time/msg/req/res, level numérico, pid,
hostname, schemaVersion, service ou environment. A configuração de referência
usa base: null, messageKey: message, timestamp próprio e level em texto.
Não criar reason por situação ou permitir payload livre como context.

A documentação histórica cita durationMs, mas o tipo/adapter atuais não o
emitem. Não apresentá-lo como implementado nem adicioná-lo silenciosamente;
medição de duração é evolução a confirmar no projeto destino.

Exemplo ilustrativo neutro, após criação realmente confirmada. O catálogo
resources/resource.created é exemplo a adaptar ao domínio, não código Civix:

~~~json
{
  "timestamp": "2026-10-13T12:00:00.000Z",
  "level": "info",
  "event": "resource.created",
  "module": "resources",
  "message": "Recurso cadastrado com sucesso",
  "requestId": "a308c858-537f-456e-9ed0-d5b2d294d4eb",
  "context": { "operation": "create", "count": 1 }
}
~~~

## Interface e responsabilidades

Referência mínima, sem importar Pino ou framework nos services:

~~~typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
interface LogHttp {
  method: string;
  route: string;
  statusCode: number;
}
interface LogInput<C> {
  event: string;
  module: string;
  message: string;
  requestId?: string;
  context?: C;
  http?: LogHttp;
  error?: unknown;
}
interface AppLogger<C> {
  debug(input: LogInput<C>): void;
  info(input: LogInput<C>): void;
  warn(input: LogInput<C>): void;
  error(input: LogInput<C>): void;
  close(): Promise<void>;
}
~~~

C deve ser contexto aprovado com allowlist real, não Record<string, any>.
Especializar module num union/enum do destino. Tipagem não substitui a
filtragem de contexto/sanitização runtime nem prova que todo input é válido.
O caller fornece event/module/message; adapter gera timestamp/level, filtra
context e sanitiza campos opcionais. O logger vinculado à requisição impõe
seu próprio requestId, impedindo substituição por um valor do service.

Disponibilizar equivalente de logger(): retorna logger do contexto ativo ou
logger base fora dele. Criar adapter, contrato, sanitizador, contexto e
middleware seguindo a estrutura existente, sem inventar interfaces para tudo.

## Nível e formato de desenvolvimento

Precedência na referência: options.level → LOG_LEVEL → padrão.
NODE_ENV exatamente development: debug; demais ambientes: info.
LOG_LEVEL aceita somente debug/info/warn/error/fatal. Valor inválido falha na
configuração, sem escolher nível silenciosamente. Respeitar filtragem por nível.

Pretty só em development, se não há destino explícito e não foi desabilitado.
Ele apresenta os mesmos campos para humanos; sua saída pode não ser JSON
por linha. Produção/homologação mantêm JSON bruto. Não misturar prompts/texto
arbitrário no stdout de comandos em modo JSON; usar stderr para interação.

| Uso | Nível |
| --- | --- |
| Consulta/validação rotineira, sem termo de busca | debug |
| Etapa de negócio realmente confirmada | info |
| Falha HTTP esperada/4xx ou conexão interrompida | warn |
| Falha inesperada/5xx | error |
| Falha que impede inicialização/execução crítica | fatal |

Fatal não substitui a decisão do processo de encerrar ou marcar falha.
Nível/status são classificados centralmente; não usar switch de mensagens
ou reason hardcoded para descrever cada situação de negócio.

## Contexto, middleware e ciclo HTTP

1. Registrar middleware antes do parser e de etapas que possam falhar.
2. Gerar UUID interno por requisição. Não confiar em ID de header/body ou
   request.id preexistente; o cliente não escolhe o identificador interno.
3. Criar logger vinculado e executar próximo passo no contexto assíncrono.
4. Preservar contexto por await/chamadas aninhadas e isolar concorrência.
5. Em finish/close, registrar um único resumo e marcar contexto como inativo.
6. Em callback tardio após conclusão, logger() retorna base, sem herdar o UUID.

Não adicionar requestId ao corpo/header HTTP. Correlacionar logs internos
não equivale a mudar o contrato de resposta. Fora de HTTP, CLI/startup usa
logger base sem fabricar requestId; jobs futuros precisam de contexto próprio
explicitamente definido, não de uma requisição já encerrada.

route usa padrão registrado, por exemplo /api/items/:id, sem ID concreto,
query, originalUrl ou URL de convite/reset. Normalizar prefixos dinâmicos.
Para rota desconhecida usar unmatched. Em aliases registrados como array,
a referência usa o primeiro padrão string, mesmo se outro alias foi chamado.

Eventos canônicos de infraestrutura:

| Evento | Regra |
| --- | --- |
| http.request.completed | Uma vez ao concluir: info abaixo de 400, warn em 4xx e error em 5xx; sem error/stack/details |
| http.request.aborted | Uma vez em conexão interrompida antes de terminar: warn; não emitir completed para a mesma finalização |
| http.request.failed | Handler global registra diagnóstico uma vez: warn para status menor que 500 e error para 5xx/inesperado |
| server.started | Inicialização confirmada, info; sem requestId |
| server.failed | Falha de inicialização, fatal; sem requestId |

failed pode coexistir com completed ou aborted: diagnóstico e resumo têm
funções distintas. Isso não autoriza repetir stack em ambos. Parser inválido
é normalizado antes de logar, sem guardar o body reproduzido na mensagem.
Se headers já foram enviados, preservar erro e encerramento do framework,
sem tentar responder novamente nem deixar o handler padrão imprimir stack bruto.

Exemplo de resumo HTTP, separado do diagnóstico:

~~~json
{
  "timestamp": "2026-10-13T12:00:00.100Z",
  "level": "error",
  "event": "http.request.completed",
  "module": "http",
  "message": "Requisição concluída",
  "requestId": "a308c858-537f-456e-9ed0-d5b2d294d4eb",
  "http": { "method": "GET", "route": "/api/items/:id", "statusCode": 500 }
}
~~~

## Diagnóstico interno e sanitização

error tem name/code/status/message/stack; cause e details quando pertinentes.
AppError conserva code/status/details originais sanitizados. Erro inesperado
usa INTERNAL_ERROR/500, mas sua message técnica sanitizada permanece no log;
isso difere da mensagem HTTP pública genérica. Não usar o serializer HTTP
inteiro como diagnóstico interno nem copiar seu wrapper aninhado de details.

Lançamento sem Error gera diagnóstico equivalente e guarda valor sanitizado
em details. Stack indisponível usa [Pilha indisponível]. Causa/nested Error é
serializada como name/message/stack/cause. AppError sem details pode produzir
details: null; não exigir cause: null quando nenhuma causa foi fornecida.

O diagnóstico interno pode existir em TODOS os ambientes. Produção continua
respondendo apenas status/message ao cliente. Exemplo interno ilustrativo:

~~~json
{
  "timestamp": "2026-10-13T12:00:00.090Z",
  "level": "error",
  "event": "http.request.failed",
  "module": "http",
  "message": "Falha no processamento da requisição",
  "requestId": "a308c858-537f-456e-9ed0-d5b2d294d4eb",
  "http": { "method": "GET", "route": "/api/items/:id", "statusCode": 500 },
  "error": {
    "name": "Error",
    "code": "INTERNAL_ERROR",
    "status": 500,
    "message": "Falha técnica sanitizada",
    "stack": "Error: Falha técnica sanitizada\n    at executeOperation (...)"
  }
}
~~~

Definir allowlist por evento: IDs internos, operação, contagem e outros
metadados aprovados. Na referência, o contexto aceita apenas propriedades
próprias da allowlist com string sanitizada ou número finito. Não copiar
campos companyId/planId/roles da Civix para um domínio que não os possui.

Excluir e-mail, destinatário, nome pessoal, telefone/documentos/endereço,
senha/hash, JWT, Authorization/cookies/headers, links e tokens de convite/
reset, connection strings, SQL/parâmetros, bodies, HTML e retorno integral de
provedor. Combinar allowlist, sanitização explícita e redaction da biblioteca.
Não confiar somente no redact do Pino para segredos escondidos em texto.

Sanitizar event/message/requestId/strings do contexto/http e diagnóstico.
A referência mascara URLs inteiras HTTP/PostgreSQL/Redis/MongoDB, e-mails,
JWT reconhecido, sequências hexadecimais longas e padrões SQL. Também remove
rotas privadas de acesso/reset/validação: ADAPTAR os padrões ao destino,
sem copiar URLs da Civix. Chaves sensíveis são removidas/mascaradas inclusive
nos detalhes/causas; não afirmar proteção universal para qualquer texto.

Não executar getters de aplicação. Representar acessores/ciclos/referências
repetidas por [Acessor]/[Circular]; valores não serializáveis por marcador;
undefined e números não finitos viram null. Não alterar protótipos ao copiar
chaves. Para erro do parser, substituir message/primeira linha da stack por
JSON inválido e preservar somente frames sanitizados, não o trecho de body.

O sanitizador de logging percorre estruturas iterativamente: SEM limite
arbitrário de profundidade, tamanho ou truncamento de registros. Não reutilizar
um sanitizador HTTP com limite de profundidade como se atendesse a essa regra.
Isso não garante processamento de qualquer objeto hostil nem emissão durável:
falha de serialização/emissão é isolada, sem substituir o fluxo de negócio.

## Adoção nos services

Usar logger() pela interface, sem importar Express/Pino ou repassar Request.
Catalogar eventos de etapas existentes; não instrumentar todas as camadas
por repetição. Registrar info somente após a confirmação da operação relevante.

- Persistência: await criar/atualizar → confirmar resultado → evento de etapa.
- Consulta: debug com operação/contagem, sem termo de busca ou lista completa.
- Credencial/convite: preparação confirmada é distinta de envio.
- E-mail: outbox salva ou provedor aceitou não significa entregue/lido.
- Falha propagada: handler HTTP ou fronteira CLI é dono do diagnóstico;
  evitar catch-log-throw em cada service/repository.
- Função delegadora não duplica o evento da executora.
- Retorno silencioso de recuperação para conta inexistente não ganha log
  que revele identidade/existência ao consumidor ou registre dados privados.

Falha de etapa posterior não apaga evidência de uma etapa já concluída, mas
não produz evento de sucesso da etapa que falhou. Se houver transação, não
declarar commit confirmado antes do resultado real. Não mudar retornos/
exceções, criar endpoints ou instrumentar repositories como requisito desta adoção.

## Falhas do logger e encerramento

Isolar falhas de formatação/escrita e eventos assíncronos de erro do destino.
Registrar erro de negócio não pode lançar outro erro e substituir o original,
nem transformar sucesso HTTP em falha. Testar adapter e acesso contextual.
Essa regra não esconde configuração inválida: inicialização do logger/LOG_LEVEL
pode falhar e precisa de tratamento de startup apropriado, sem console bruto.

close() é idempotente e encerra/aguarda transporte/worker criado pelo próprio
logger. Não fechar stdout/destino injetado de outro proprietário; close do
logger vinculado à requisição não encerra o logger base. CLI fecha readline e
seu logger ao terminar. Integrar shutdown conforme ciclo do projeto destino;
não afirmar que qualquer aplicação já possui flush/retenção/shutdown completo.

## Tarefas no destino — fases separadas

Fundação / commit 1, se commits autorizados:

- [x] LOG-01: Conferir runtime/logger existente e aprovar libs/configuração necessárias.
- [x] LOG-02: Implementar contrato, adapter, allowlist e sanitização sem truncamento.
- [x] LOG-03: Implementar contexto assíncrono isolado e middleware antes do parser.
- [x] LOG-04: Integrar resumo/aborto/handler e startup sem alterar HTTP.
- [x] LOG-05: Testar fundação e atualizar documentação principal.

Adoção / commit 2, dependente da fundação:

- [ ] LOG-06: Mapear etapas/eventos e metadados permitidos dos services existentes.
- [ ] LOG-07: Emitir eventos após confirmação, evitando diagnóstico duplicado.
- [ ] LOG-08: Adequar CLI/delegadores/integrações existentes, sem inventar sucesso externo.
- [ ] LOG-09: Testar sucesso/falha de etapas, atualizar documentação/evidências e revisar.

## Critérios de aceite

Comparar chaves/formatos exatos de NDJSON; testar todos os níveis, defaults,
override inválido e pretty restrito ao desenvolvimento. Conferir ausência
de metadados padrão e de durationMs não contratado.

Testar requisições simultâneas, await aninhado, ID malicioso do cliente,
callback depois de finish, execução fora de HTTP, finish+close e aborto único.
Provar erro global único + resumo sem repetir diagnóstico; aliases/unmatched
não expõem caminho concreto/query. Parser e headers já enviados preservam erro.

Provar stack/causa sanitizados no log em production e nenhuma mudança de
status/body/headers HTTP. Testar falha de escrita, erro assíncrono do destino,
getter que lança, ciclos, tipos não serializáveis e padrões sensíveis.
Provar que mensagem grande e diagnóstico profundo não recebem corte artificial;
isso não é benchmark nem garantia de persistência sob qualquer carga.

Services: ausência de sucesso após falha; sucesso somente após confirmação;
delegação sem evento duplicado; outbox/aceite separados de entrega. Usar
adapters já existentes no destino; não criar banco/provedor por causa dos logs.
Comparar comportamento antes/depois, usando testes reais disponíveis.

## Decisões do projeto destino e pendências

Para a fundação, o catálogo aprovado contém `http`, `server`, `auth`,
`accounts`, `categories`, `transactions`, `recurring-transactions` e
`dashboard`. A allowlist de contexto contém `operation`, `count`, `userId`,
`accountId`, `categoryId`, `transactionId` e `recurringTransactionId`.

As versões já instaladas de Pino, pino-http e pino-pretty foram mantidas. O
projeto utiliza middleware próprio e não ativa o middleware do pino-http, para
evitar eventos duplicados e preservar o formato contratado. A fundação está
integrada ao ciclo HTTP, ao handler global e ao startup/shutdown do servidor.

Continuam pendentes a adoção nos services, o destino remoto, a retenção, a
coleta, a pesquisa histórica e eventual medição de duração. Não tratar a saída
local como auditoria ou alertas antes dessas decisões e implementações.
Não instalar, enviar a terceiros ou alterar infraestrutura sem autorização.

Complemento opcional: [contrato de erro HTTP](../http-contracts/error.spec.md).
Esse arquivo auxilia integração, mas não é necessário para entender o formato
interno de logging definido aqui. Não copiar restrições de diagnóstico HTTP
para reduzir os registros internos contra este contrato.
