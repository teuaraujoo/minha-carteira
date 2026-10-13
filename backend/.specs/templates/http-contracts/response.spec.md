# Contrato HTTP de resposta de sucesso

## Objetivo

Padronizar as respostas JSON de sucesso da API da Minha Carteira. O contrato
se aplica às rotas versionadas em `/api/v1` e não altera regras de negócio,
autenticação, persistência ou URLs.

As rotas provisórias `/` e `/health` são endpoints de infraestrutura e ficam
fora deste contrato. Arquivos, streams e respostas sem conteúdo também não
devem ser envolvidos automaticamente no envelope JSON.

## Contrato obrigatório

Toda resposta JSON de sucesso deve possuir `data`. O campo `meta` é opcional:

```typescript
interface SuccessResponse<T, M = never> {
  data: T;
  meta?: M;
}
```

- `data` contém um DTO público serializável, um array, um valor ou `null`,
  quando o endpoint permitir `null` explicitamente.
- `data` nunca deve ser `undefined`.
- `meta` deve ser omitido quando não houver metadados.
- `meta` deve ser tipado de acordo com a operação.
- A raiz não deve conter `success`, `status`, `code` ou `message`.
- Uma mensagem de sucesso necessária deve ficar em `data.message`.
- O presenter não deve produzir envelopes duplicados, como
  `{ "data": { "data": resultado } }`.
- O DTO nunca deve expor senha, hash, token, cookie ou propriedades internas
  do Prisma.

Os helpers de resposta apenas montam o envelope. A conversão de datas, UUIDs e
valores monetários pertence aos presenters e DTOs de cada módulo.

## Status e exemplos

| Situação | HTTP | Corpo |
| --- | --- | --- |
| Consulta ou operação com resultado | 200 | `{ "data": resultado }` |
| Recurso criado | 201 | `{ "data": recursoCriado }` |
| Operação concluída sem conteúdo | 204 | Sem corpo |
| Lista sem registros | 200 | `{ "data": [] }` |

Exemplo ilustrativo do envelope para criação de conta financeira, HTTP 201.
Os campos foram resumidos e não substituem o `AccountView` completo:

```json
{
  "data": {
    "id": "2b8b2f40-8018-4dd2-a2a5-541d551a39ca",
    "name": "Conta principal",
    "type": "CHECKING",
    "currency": "BRL"
  }
}
```

Uma consulta unitária sem resultado deve seguir a regra do endpoint,
normalmente `404` pelo contrato de erro. Uma falha de persistência não deve ser
convertida em `200`, `null` ou lista vazia.

## Responsabilidades por camada

1. O caso de uso retorna uma entidade ou DTO de aplicação, ou informa uma
   falha tipada sem conhecer HTTP.
2. O presenter converte o resultado em DTO público.
3. O controller escolhe o status HTTP.
4. O helper HTTP monta `{ data }` ou `{ data, meta }`.
5. O Express envia a resposta uma única vez.

Equivalentes a `createSuccessResponse`, `sendSuccess`, `sendCreated` e
`sendNoContent` podem ser criados na camada de apresentação. Esses nomes são
referências e não obrigam uma implementação específica.

O frontend deve ler `body.data` e, em respostas paginadas, `body.meta`. Uma
resposta `204` não possui JSON e não deve passar por `response.json()`.

## Critérios de aceite

- [ ] Respostas `200` e `201` com conteúdo usam exatamente o envelope `data`.
- [ ] `meta` é omitido quando não foi fornecido.
- [ ] Respostas `204` não possuem corpo.
- [ ] Listas vazias retornam `data: []`.
- [ ] Mensagens de sucesso ficam em `data.message`.
- [ ] Erros seguem o contrato de erro e nunca são envolvidos em `data`.
- [ ] DTOs não expõem campos sensíveis ou objetos do Prisma.
- [ ] Pelo menos um fluxo HTTP real e seu consumidor são validados quando a
      implementação for adicionada.

## Estado de adoção

Este arquivo define o contrato esperado. O backend atual possui somente rotas
provisórias de inicialização e ainda não implementa os helpers ou as rotas
versionadas. A existência desta spec não comprova implementação.

Consulte também os contratos de [erro](error.spec.md) e
[paginação](pagination.spec.md).
