# Contrato HTTP de paginação

## Objetivo e escopo

Padronizar a entrada, o cálculo de deslocamento e os metadados das listagens
que podem crescer continuamente.

No MVP, o contrato deve ser aplicado inicialmente a
`GET /api/v1/transactions`. Contas e categorias não devem receber paginação
apenas por conveniência técnica. Novas listagens precisam aprovar essa
necessidade em sua própria spec.

Os helpers não consultam o banco, não contam registros e não recortam arrays
em memória. A integração com Prisma deve realizar a contagem e a consulta já
limitadas ao usuário autenticado e aos mesmos filtros.

## Entrada e validação

Os parâmetros de paginação são `page` e `pageSize`. Somente `undefined` aplica
o valor padrão.

| Campo | Padrão | Regra |
| --- | --- | --- |
| `page` | `1` | Inteiro seguro maior que zero |
| `pageSize` | `20` | Inteiro seguro entre 1 e 100 |

Aceitar um número inteiro positivo seguro ou uma string decimal que corresponda
a `/^[1-9]\d*$/`. A conversão deve resultar em um inteiro seguro.

Rejeitar `null`, boolean, array, objeto, string vazia, zero, número negativo,
fração, `NaN`, `Infinity` e valor maior que `Number.MAX_SAFE_INTEGER`. Também
rejeitar `01`, `+1`, `1.0`, `1e2` e valores com espaços. Um parâmetro repetido
que o Express entregue como array é inválido.

Entrada inválida deve produzir `AppError` com:

```typescript
{
  status: 400,
  code: ErrorCode.VALIDATION_ERROR,
  message: 'Paginação inválida',
}
```

## Tipos e cálculos

```typescript
interface PaginationInput {
  page: number;
  pageSize: number;
  offset: number;
}

interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
```

Calcular `offset` como `(page - 1) * pageSize`. O resultado deve continuar
sendo um inteiro seguro. Se os parâmetros fornecidos produzirem overflow, a
entrada é inválida e deve resultar em `400 VALIDATION_ERROR`.

`total` representa a quantidade inteira, segura e não negativa de registros
ativos que pertencem ao usuário autenticado e atendem aos mesmos filtros,
antes da paginação. Calcular `totalPages` como
`Math.ceil(total / pageSize)`.

Um `total` inválido ou um `offset` interno diferente daquele calculado a
partir da entrada já validada representa falha de programação e deve resultar
em erro inesperado `500`.

## Saída HTTP

Uma listagem paginada retorna `data` como array e `meta` com os quatro campos
definidos acima. O item abaixo é um recorte ilustrativo e não substitui o
`TransactionView` completo:

```json
{
  "data": [
    {
      "id": "7e0771a8-f32b-4e7f-91ea-ef0e8df1c385",
      "description": "Supermercado"
    }
  ],
  "meta": {
    "page": 2,
    "pageSize": 20,
    "total": 21,
    "totalPages": 2
  }
}
```

Para uma consulta vazia, retornar `data: []`, `total: 0` e `totalPages: 0`,
mantendo `page` e `pageSize`. Para uma página posterior à última, retornar
`data: []` e os valores reais de `total` e `totalPages`; não retornar `404` e
não ajustar `page` silenciosamente.

`offset` é interno e não faz parte da resposta HTTP. Não criar
`meta.pagination`, `items`, `results` ou `totalItems` como alternativas.

## Filtros, autorização e ordenação

Em `GET /api/v1/transactions`, `page` e `pageSize` são parâmetros de paginação.
`competence`, `startDate`, `endDate`, `type`, `status`, `accountId`,
`categoryId` e `search` são filtros. `sortBy` e `sortOrder` controlam a
ordenação e não integram `PaginationInput`.

1. Obtenha o `userId` da sessão autenticada, nunca da query string.
2. Valide a paginação no limite HTTP.
3. Aplique o mesmo `userId`, os mesmos filtros e a mesma regra de exclusão
   lógica na contagem e na consulta.
4. Aceite somente campos de ordenação explicitamente permitidos pelo endpoint.
5. Adicione um identificador único como desempate para manter ordem estável.
6. Use `take` e `skip`, ou operações equivalentes do Prisma, sem concatenar
   valores recebidos do cliente.
7. Monte os metadados e devolva `{ data, meta }`.

A paginação por deslocamento não garante uma fotografia imutável entre duas
requisições concorrentes. O MVP não promete consistência de snapshot.

## Critérios de aceite

- [ ] Os valores padrão são `page=1` e `pageSize=20`.
- [ ] `pageSize=100` é aceito e `pageSize=101` é rejeitado.
- [ ] Formatos numéricos permissivos ou ambíguos são rejeitados.
- [ ] Overflow de `offset` causado pela query resulta em erro 400.
- [ ] `offset` interno incoerente resulta em erro 500.
- [ ] `total=0` produz `totalPages=0`.
- [ ] `total=21` e `pageSize=20` produzem `totalPages=2`.
- [ ] Uma página além do fim retorna `data: []`, sem `404`.
- [ ] Contagem e consulta usam os mesmos filtros e o mesmo `userId`.
- [ ] A consulta possui ordenação estável e usa paginação no banco.
- [ ] Um teste HTTP prova o contrato completo quando o endpoint for implementado.

## Estado de adoção

Este arquivo define o contrato esperado. O endpoint de movimentações e os
helpers de paginação ainda não estão implementados. A existência desta spec não
comprova integração com Prisma.

Consulte também os contratos de [resposta](response.spec.md) e
[erro](error.spec.md).
