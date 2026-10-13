# Contrato HTTP de erro

## Objetivo

Representar falhas esperadas com um erro central e serializar todas as falhas
HTTP em um único middleware do Express. Erros não devem usar status `200`, ser
envolvidos em `data` ou depender da interpretação textual de mensagens.

## Erro da aplicação

```typescript
enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

interface AppErrorOptions {
  status: number;
  code: ErrorCode;
  message: string;
  details?: unknown;
  cause?: unknown;
}
```

`AppError` deve pertencer à camada HTTP, estender `Error`, preservar `stack`
e `cause`, e expor `status`, `code` e `details`. Entidades e casos de uso
não devem depender desse tipo nem conhecer status HTTP.

- `status` deve ser um inteiro entre 400 e 599.
- `code` deve pertencer a `ErrorCode`.
- `message` deve ser uma mensagem pública em português, não vazia.
- `details` pode conter um diagnóstico estruturado e sanitizado.
- `cause` preserva a exceção original somente para diagnóstico interno.
- Erros de programação na construção devem continuar sendo erros internos.

O caso de uso informa uma falha tipada de domínio ou aplicação. A camada de
apresentação converte essa falha em `AppError`, e o controller a encaminha ao
middleware global sem repetir a serialização.

| Situação | HTTP | Código |
| --- | --- | --- |
| Entrada inválida | 400 | `VALIDATION_ERROR` |
| Credencial ou sessão ausente, inválida ou expirada | 401 | `UNAUTHORIZED` |
| Ação autenticada não permitida | 403 | `FORBIDDEN` |
| Recurso ou rota não encontrado | 404 | `NOT_FOUND` |
| Conflito de estado ou unicidade | 409 | `CONFLICT` |
| Corpo acima do limite configurado | 413 | `VALIDATION_ERROR` |
| Falha interna inesperada | 500 | `INTERNAL_ERROR` |

A tabela orienta o ponto onde a falha é criada. O sistema não deve possuir um
`switch` universal que tente deduzir status pelo texto da mensagem.

## Resposta em produção

Produção corresponde exatamente a `NODE_ENV === 'production'`. O cliente não
pode controlar essa configuração.

Em produção, o corpo contém somente `status` e `message`. O status HTTP deve ser
igual ao campo `status`.

Erro esperado, HTTP 400:

```json
{
  "status": 400,
  "message": "Campo inválido."
}
```

Erro inesperado, HTTP 500:

```json
{
  "status": 500,
  "message": "Erro interno do servidor."
}
```

Não retornar `code`, `details`, `stack`, `requestId`, `cause` ou `name` em
produção. Um `AppError` mantém seu status e sua mensagem pública. Uma exceção
desconhecida sempre deve resultar em status `500` e mensagem genérica, mesmo
que o valor lançado possua propriedades chamadas `status` ou `message`.

## Resposta fora de produção

Somente em `development` e `test`, incluir os campos diagnósticos disponíveis
e já sanitizados. O exemplo abaixo representa esses dois ambientes:

```json
{
  "status": 400,
  "message": "Campo inválido.",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email"
  },
  "stack": "AppError: Campo inválido.\n    at validateInput (...)",
  "requestId": "request-example"
}
```

Qualquer outro valor, inclusive `staging`, `preview` ou `NODE_ENV` ausente,
deve usar a resposta restrita de produção.

`requestId` deve ser omitido quando não for fornecido. Gerar um identificador
nos logs não o adiciona automaticamente à resposta.

## Sanitização

Sanitizar os campos `message`, `stack`, `details`, `cause` e `requestId`
antes de serializá-los ou registrá-los. Mascarar valores associados às chaves
abaixo, sem diferenciar maiúsculas e minúsculas:

- `password` e `passwd`;
- `secret`;
- `token`, `accessToken` e `refreshToken`;
- `authorization`;
- `cookie` e `set-cookie`;
- `credential`;
- `apiKey`, `api_key` e `api-key`.

Também remova tokens Bearer, credenciais em URLs HTTP ou PostgreSQL e
atribuições textuais reconhecidas. Use `"[REMOVIDO]"` como marcador.

O serializador deve tratar arrays, referências repetidas ou circulares e
acessores sem executar getters da aplicação. Use os marcadores `"[Circular]"`,
`"[Acessor]"` e `"[Limite de profundidade]"`. Valores diagnósticos
`undefined` podem ser representados por `null`.

A sanitização não substitui a regra de coletar somente os dados necessários.
Corpos de requisição, dados financeiros, credenciais e cookies não devem ser
incluídos integralmente nos diagnósticos.

## Autorização e IDOR

Uma rota autenticada não deve confiar em `userId` enviado pelo cliente. O
middleware de autenticação fornece o usuário atual, e o módulo responsável
consulta o recurso por identificador e proprietário.

Quando um recurso privado não existir ou pertencer a outro usuário, a API deve
responder `404 NOT_FOUND`. Essa política evita revelar a existência de recursos
de terceiros. `403 FORBIDDEN` fica reservado a ações conhecidas em que a
existência do recurso pode ser revelada com segurança.

## Integração com Express

1. Registre os parsers e routers.
2. Converta JSON inválido em `400`, `VALIDATION_ERROR` e `"JSON inválido."`.
3. Converta corpo excessivo em `413`, `VALIDATION_ERROR` e
   `"Corpo da requisição excede o limite permitido."`.
4. Registre, depois das rotas, um middleware que produza `404`, `NOT_FOUND` e
   `"Recurso não encontrado."`.
5. Registre o middleware global de erro por último.
6. Envie `response.status(body.status).json(body)` uma única vez.
7. Se os headers já tiverem sido enviados, encaminhe a falha ao mecanismo do
   Express e não tente produzir outro JSON.

Quando a integração prevista com Pino for implementada, registre diagnósticos
sanitizados: nível `warn` para falhas 4xx e `error` para falhas 5xx. Uma falha
do logger não pode substituir o erro original.

O frontend deve usar o status HTTP e `body.message`. Campos diagnósticos não
devem controlar autorização ou regras de negócio no cliente.

## Critérios de aceite

- [ ] `AppError` valida status, código e mensagem.
- [ ] Produção retorna somente `status` e `message`.
- [ ] Somente `development` e `test` expõem diagnósticos sanitizados.
- [ ] Ambientes desconhecidos usam a resposta restrita de produção.
- [ ] Segredos são mascarados em objetos, arrays, causas e texto.
- [ ] Ciclos, getters e profundidade excessiva não quebram a serialização.
- [ ] JSON inválido produz 400; corpo excessivo produz 413.
- [ ] Rota inexistente produz 404; exceção desconhecida produz 500.
- [ ] Recurso de outro usuário não pode ser enumerado por diferença de erro.
- [ ] Resposta já iniciada não recebe um segundo corpo.
- [ ] Logs não expõem credenciais, cookies ou dados financeiros desnecessários.

## Estado de adoção

Este arquivo define o contrato esperado. O backend atual ainda não implementa
`AppError`, o serializador ou os middlewares globais. A existência desta spec
não comprova autenticação, autorização ou proteção contra IDOR.

Consulte também os contratos de [resposta](response.spec.md) e
[paginação](pagination.spec.md).
