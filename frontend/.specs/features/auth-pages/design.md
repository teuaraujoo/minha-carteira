# Design técnico — telas de autenticação

## Contexto atual

O frontend usa Next.js 16 com App Router, React 19, TypeScript, Tailwind CSS,
shadcn/ui, React Hook Form, Zod, TanStack React Query e `react-hot-toast`. Ainda
não existem rotas, serviços ou componentes de autenticação.

O shell atual representa a área privada. As páginas públicas de autenticação não
devem renderizar sidebar, notificações ou menu de perfil.

## Organização proposta

```text
frontend/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   └── (private)/
│       └── ...
├── components/
│   └── auth/
├── lib/
│   ├── http/
│   └── validation/
├── providers/
└── services/
    └── auth/
```

Os nomes entre parênteses são route groups e não alteram as URLs. A migração das
páginas privadas existentes para `(private)` deve ocorrer somente se for
necessária para aplicar layouts distintos e depois de verificar os imports.

## Responsabilidades

### Camada `app`

- compõe cada página;
- lê `searchParams` quando necessário;
- define metadados;
- aplica redirecionamentos possíveis no servidor;
- não contém regras de parsing do contrato HTTP.

### Componentes de autenticação

- renderizam campos, botões e mensagens;
- controlam formulários com React Hook Form;
- usam schemas Zod específicos;
- não fazem chamadas HTTP diretamente.

### Serviços

- conhecem rotas e DTOs da API;
- enviam `credentials: "include"`;
- convertem o envelope HTTP em resultados tipados;
- não armazenam tokens.

### Provider de autenticação

- consulta `/api/v1/auth/me` para conhecer a sessão;
- mantém somente `userId`, `sessionId` e estado da consulta em memória;
- não representa o perfil completo;
- coordena logout e redirecionamentos;
- usa `/api/v1/users/me` quando a interface precisar do perfil.

## Contratos do frontend

```typescript
interface LoginInput {
  identifier: string;
  password: string;
}

interface RegisterInput {
  username: string;
  name: string;
  email: string;
  phone: string;
  password: string;
}

interface RequestPasswordResetInput {
  email: string;
}

interface ResetPasswordInput {
  token: string;
  password: string;
  passwordConfirmation: string;
}

interface AuthContext {
  userId: string;
  sessionId: string;
}

interface UserOutput {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  capabilities: string[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginOutput {
  user: UserOutput;
}

interface SuccessResponse<T, M = never> {
  data: T;
  meta?: M;
}

interface ErrorResponse {
  status: number;
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
}
```

`passwordConfirmation` faz parte do contrato de confirmação do backend, mas deve
ser removida do payload de cadastro.

Login retorna `SuccessResponse<LoginOutput>`. Cadastro retorna
`SuccessResponse<UserOutput>`. `/auth/me` retorna
`SuccessResponse<AuthContext>`. Respostas 204 não possuem JSON. O frontend usa
somente `status` e `message` dos erros como contrato estável de produção. Campos
diagnósticos opcionais não controlam regras do cliente.

## Integração HTTP

| Ação | Método e endpoint | Resultado esperado |
| --- | --- | --- |
| Cadastro | `POST /api/v1/auth/register` | 201 |
| Login | `POST /api/v1/auth/login` | 200 e cookies |
| Sessão | `GET /api/v1/auth/me` | 200 com contexto mínimo |
| Refresh | `POST /api/v1/auth/refresh` | 204 e novo access cookie |
| Logout | `POST /api/v1/auth/logout` | 204 e cookies removidos |
| Solicitar reset | `POST /api/v1/auth/password-reset` | 202 neutro |
| Confirmar reset | `POST /api/v1/auth/password-reset/confirm` | 204 |

A origem da API deve vir de configuração pública validada. Todas as chamadas que
dependem de cookies usam `credentials: "include"`. O cliente HTTP não deve
incluir token em headers por conta própria.

## Renovação da sessão

1. A requisição privada recebe o erro de sessão definido pelo backend.
2. O cliente inicia uma única chamada compartilhada de refresh.
3. Requisições concorrentes aguardam essa mesma Promise.
4. Se o refresh funcionar, cada requisição original é repetida uma vez.
5. Se falhar, o estado local é limpo e a navegação segue para `/login`.

O cliente inicia refresh somente para status 401 de uma requisição privada
elegível. Essa regra não depende de `code`, pois o backend o omite em produção.
O cliente deve marcar a requisição repetida para impedir loop infinito.

O mecanismo nunca tenta refresh para login, cadastro, logout, refresh ou
recuperação de senha. Ele só atua no código final de access expirado. A Promise
compartilhada é limpa em `finally`; uma falha rejeita a fila e dispara no máximo
um redirecionamento.

## Bootstrap dos providers

O provider raiz deve compor `QueryClientProvider`, `AuthProvider` e `Toaster`
antes das páginas. `AuthProvider` já nasce com a consulta de `/auth/me`, ações de
login e logout e invalidação do estado. Mensagens que atravessam um redirect usam
somente valores públicos em allowlist: `/login?status=registered` e
`/login?status=password-reset`. A tela mapeia esses valores para textos fixos e
ignora qualquer outro valor.

## Fluxos das páginas

### Fluxo — login

1. **Input:** pessoa informa e-mail ou nome de usuário e senha.
2. **Validação:** schema exige os dois campos e preserva a senha original.
3. **Serviço:** envia `LoginInput` com cookies habilitados.
4. **Backend:** cria a sessão e define cookies `HttpOnly`.
5. **Estado:** invalida a consulta de sessão.
6. **Resposta:** redireciona para `/` e não exibe tokens.

### Fluxo — cadastro

1. **Input:** pessoa informa nome, username, e-mail, telefone e duas senhas.
2. **Validação:** Zod valida igualdade das senhas e regras aprovadas.
3. **Serviço:** remove `passwordConfirmation` e envia `RegisterInput`.
4. **Backend:** cria o usuário sem criar sessão.
5. **Estado:** não altera o contexto autenticado.
6. **Resposta:** redireciona para `/login` com confirmação de conta criada.

### Fluxo — solicitar recuperação

1. **Input:** pessoa informa o e-mail.
2. **Validação:** Zod valida e normaliza o endereço.
3. **Serviço:** envia `RequestPasswordResetInput`.
4. **Backend:** responde 202 de forma neutra.
5. **Estado:** substitui o formulário pela confirmação na mesma página.
6. **Resposta:** informa que o link será enviado caso a conta exista.

### Fluxo — definir nova senha

1. **Input:** componente cliente lê `token` com `useSearchParams`, mantém o valor
   em memória e substitui a URL por `/reset-password`.
2. **Validação:** token precisa existir e as senhas precisam coincidir.
3. **Serviço:** envia `ResetPasswordInput`; não registra nem persiste o token.
4. **Backend:** consome o token, troca a senha e revoga as sessões.
5. **Estado:** limpa os campos sensíveis imediatamente após o sucesso.
6. **Resposta:** redireciona para `/login` com confirmação de senha alterada.

### Fluxo — link inválido

1. **Input:** token está ausente ou o backend o rejeita.
2. **Validação:** formulário fica indisponível se o token estiver ausente.
3. **Serviço:** nenhuma chamada ocorre sem token.
4. **Backend:** token rejeitado usa o código HTTP definido na spec de `auth`.
5. **Estado:** remove valores digitados da memória do formulário.
6. **Resposta:** exibe mensagem segura e link para `/forgot-password`.

## Schemas de validação

- schemas HTTP e de formulário ficam separados;
- senha nunca usa `trim` ou transformação;
- e-mail pode remover espaços externos e usar letras minúsculas;
- username segue a normalização aprovada no backend;
- telefone só recebe máscara depois da decisão de formato;
- confirmação de senha usa refinamento do schema do formulário;
- mensagens são específicas, curtas e escritas em português.

O backend continua sendo a autoridade. Validação no navegador melhora a
experiência, mas não substitui a validação da API.

## Estados de interface

Cada página deve representar explicitamente:

- inicial;
- preenchimento;
- envio em andamento;
- erro de campo;
- erro de formulário;
- sucesso;
- indisponibilidade temporária, quando prevista pelo contrato.

O botão principal mostra texto de progresso e permanece desabilitado durante o
envio. O formulário não é limpo após erro de credencial, exceto a senha quando a
segurança ou o fluxo exigir.

## Tratamento de erros

- usar validação local para os erros de campo;
- mostrar erros do backend no nível do formulário enquanto produção não expuser
  um contrato estável de caminhos de campo;
- mostrar erro genérico do login no nível do formulário;
- nunca traduzir usuário inativo para uma mensagem diferente no login;
- tratar token inválido ou expirado como um único estado público;
- manter a confirmação neutra da recuperação após 202;
- usar uma mensagem geral segura para falhas inesperadas;
- não renderizar detalhes diagnósticos, stack traces ou dados sensíveis.

## Navegação e proteção

- rotas de autenticação não usam `AppShell`;
- rotas privadas exigem sessão validada;
- usuário autenticado em rota pública vai para `/`;
- logout sempre leva a `/login`, mesmo se a sessão já estiver inválida;
- a URL de retorno após login permanece pendente;
- redirects devem impedir ciclos entre middleware, layout e provider.

O mecanismo exato de proteção deve respeitar que cookies `HttpOnly` podem ser
lidos pelo servidor Next, mas não pelo JavaScript do navegador. A API, e não a
mera presença do cookie, confirma a validade da sessão.

### Decisão obrigatória — topologia dos cookies

Antes de implementar a proteção, escolher uma opção:

1. **Mesma origem, recomendada:** expor a API sob a origem do frontend por proxy
   ou rewrite. O servidor Next encaminha os cookies para `/auth/me` e protege o
   layout privado antes de renderizar.
2. **Origens separadas:** usar guarda inicial client-side. O `AuthProvider` chama
   a API com `credentials: "include"` e segura o conteúdo enquanto valida a
   sessão.

O servidor Next só recebe cookies compatíveis com o host, domínio e path da
requisição. A escolha deve permanecer coerente com CORS, CSRF e cookies do
backend.

### Decisão obrigatória — organização privada

Antes de implementar a proteção, escolher uma opção:

1. **Route group, recomendado:** mover páginas privadas para `(private)` e
   aplicar `AppShell` e guarda em um layout compartilhado.
2. **Estrutura atual:** manter `AppShell` em cada página e aplicar a guarda em um
   provider superior, sem duplicar a validação.

A migração não altera URLs, mas move arquivos existentes e deve ser uma tarefa
explicitamente aprovada.

## Design visual

- ocupar pelo menos todo o viewport disponível;
- usar fundo `background` e card `surface` definidos no `DESIGN.md`;
- usar a logo oficial sem distorção;
- limitar a largura do formulário para leitura confortável;
- usar bordas e contraste em vez de sombras fortes;
- reservar `accent` para foco e detalhes, sem excesso de gradientes;
- manter espaçamento de 16 px entre campos e 24 px no card;
- usar componentes compartilhados para consistência entre as quatro páginas.

O layout pode usar card centralizado no MVP. Uma composição dividida com conteúdo
decorativo só deve ser adicionada depois de aprovação visual.

### Divergência tipográfica existente

O `DESIGN.md` define Space Grotesk e Poppins, enquanto o root layout atual usa
Figtree e Geist. As telas de autenticação não devem introduzir outra combinação.
A fonte definitiva deve ser confirmada antes do acabamento visual e corrigida de
forma global em tarefa separada, se necessário.

## Acessibilidade

- associar cada label ao campo correspondente;
- usar `autocomplete` adequado: `username`, `email`, `tel`, `current-password`
  e `new-password`;
- manter foco visível;
- mover o foco para o resumo de erro após falha de envio;
- anunciar status assíncronos com `aria-live` sem repetir mensagens;
- permitir mostrar ou ocultar senha sem alterar o valor;
- garantir alvo mínimo confortável para botões e links;
- respeitar `prefers-reduced-motion`;
- não usar somente cor para comunicar estados.

## Segurança

- não persistir senha ou token;
- não colocar token em toast, analytics, logs ou mensagens de erro;
- evitar que a URL completa de reset seja enviada a serviços externos;
- responder com `Referrer-Policy: no-referrer` e `Cache-Control: no-store`;
- não carregar analytics ou recursos de terceiros na redefinição;
- remover a query da barra de endereço após capturar o token;
- sanitizar a query nos logs do Next, proxy e hospedagem;
- enviar cabeçalho ou token CSRF somente após o backend definir o contrato;
- não considerar a presença local de estado como prova de autenticação.

Os headers da resposta pertencem a `next.config.ts` ou à borda HTTP equivalente
do Next. A sanitização da URL pertence ao proxy e à hospedagem. Se algum ambiente
não permitir sanitização, a alternativa é transportar o token no fragmento da
URL. Essa alternativa exige alterar também o link produzido pelo backend.

## Testes e verificação

Sem uma ferramenta de testes de componentes aprovada, a implementação deve usar
os scripts existentes e uma verificação manual documentada:

```powershell
yarn lint
yarn build
```

A validação manual deve cobrir teclado, mobile, desktop, erros, redirecionamentos
e ausência de tokens no storage. A inclusão de testes automatizados de componente
ou navegador exige aprovação prévia da dependência correspondente.

No Next.js 16, `searchParams` recebido por uma page é assíncrono. Uma page
servidora usa `await`. Um componente cliente usa `useSearchParams` dentro de
`Suspense`. O login pode ler `status` no servidor. A redefinição usa componente
cliente para remover a query logo após a captura.

## Referências do framework

- [Next.js — page.js](https://nextjs.org/docs/app/api-reference/file-conventions/page);
- [Next.js — cookies](https://nextjs.org/docs/app/api-reference/functions/cookies);
- [Next.js — authentication](https://nextjs.org/docs/app/guides/authentication).
