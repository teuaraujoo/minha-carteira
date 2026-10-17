# Telas de autenticação

## Objetivo

Criar a experiência pública de autenticação do Minha Carteira no frontend. A
feature inclui login, cadastro, solicitação de recuperação e definição de nova
senha, integrada aos contratos definidos nas specs do backend.

## Resultado esperado

- permitir login com e-mail ou nome de usuário;
- permitir cadastro público de usuário;
- permitir solicitar um link de recuperação por e-mail;
- permitir definir uma nova senha a partir do token do link;
- redirecionar para o login depois do cadastro e da redefinição;
- proteger as páginas privadas e manter a sessão por cookies `HttpOnly`;
- apresentar todos os textos e erros em português do Brasil.

## Rotas da feature

| Rota | Finalidade | Acesso |
| --- | --- | --- |
| `/login` | Iniciar uma sessão | Público |
| `/register` | Criar um usuário | Público |
| `/forgot-password` | Solicitar o link de recuperação | Público |
| `/reset-password?token=...` | Definir uma nova senha | Público com token |

“Redefinir senha” exige duas páginas porque o backend possui uma operação para
solicitar o link e outra para confirmar a nova senha. A confirmação de envio e
os estados de token inválido permanecem na própria página correspondente.

## Escopo

### Incluído

- layout público responsivo para autenticação;
- formulários com React Hook Form e Zod;
- estados de carregamento, sucesso e erro;
- acessibilidade por teclado e leitores de tela;
- integração HTTP com cookies e credenciais habilitadas;
- redirecionamento de usuário autenticado para a aplicação;
- proteção das rotas privadas;
- tentativa única de renovar a sessão quando o access token expirar;
- mensagens neutras no pedido de recuperação;
- preservação segura do token recebido na URL;
- uso da identidade visual e dos tokens do `DESIGN.md`.

### Fora do escopo

- login social, MFA, passkeys ou biometria;
- confirmação de e-mail;
- código numérico de recuperação;
- opção “lembrar de mim”;
- login automático após cadastro ou redefinição;
- painel administrativo e alteração de capabilities;
- definição de política de senha, telefone, cookies ou CSRF no frontend;
- criação de uma biblioteca nova de testes sem aprovação.

## Requisitos funcionais

### FE-AUTH-RF-001 — Login

O sistema DEVE apresentar um formulário com `identifier` e `password`.
`identifier` aceita e-mail ou nome de usuário no mesmo campo.

### FE-AUTH-RF-002 — Resultado do login

Após login bem-sucedido, o sistema DEVE redirecionar para `/`. Em caso de falha,
deve mostrar a mensagem genérica do contrato HTTP sem revelar se o usuário
existe, está inativo ou informou uma senha incorreta.

### FE-AUTH-RF-003 — Cadastro

O sistema DEVE apresentar `username`, `name`, `email`, `phone`, `password` e
`passwordConfirmation`. A confirmação é validada somente no frontend e não é
enviada ao backend.

### FE-AUTH-RF-004 — Resultado do cadastro

Após cadastro bem-sucedido, o sistema DEVE redirecionar para `/login` e informar
que a conta foi criada. O cadastro não deve iniciar uma sessão automaticamente.

### FE-AUTH-RF-005 — Solicitação de recuperação

O sistema DEVE receber um e-mail em `/forgot-password` e mostrar a mesma
confirmação neutra após resposta 202, exista ou não uma conta correspondente.

### FE-AUTH-RF-006 — Redefinição de senha

O sistema DEVE obter `token` da URL e apresentar `password` e
`passwordConfirmation`. O token não pode ser exibido, persistido em storage nem
incluído em logs do frontend.

### FE-AUTH-RF-007 — Token ausente ou inválido

Quando o token estiver ausente, expirado, usado ou inválido, a página DEVE
mostrar um estado seguro com acesso à solicitação de um novo link. A senha não
pode ser enviada sem token.

### FE-AUTH-RF-008 — Resultado da redefinição

Após resposta 204, o sistema DEVE redirecionar para `/login` e informar que a
senha foi alterada. Nenhuma sessão deve ser considerada ativa.

### FE-AUTH-RF-009 — Sessão por cookies

O frontend DEVE enviar credenciais nas chamadas à API. Ele não pode ler, salvar
ou copiar access e refresh tokens para JavaScript, `localStorage` ou
`sessionStorage`.

### FE-AUTH-RF-010 — Proteção de navegação

Páginas privadas DEVEM exigir uma sessão válida. Páginas públicas de
autenticação DEVEM redirecionar usuários já autenticados para `/`.

### FE-AUTH-RF-011 — Renovação de sessão

Ao receber 401 em uma requisição privada elegível, o cliente DEVE tentar o
endpoint de refresh uma única vez e repetir a requisição original uma única vez.
Se o refresh falhar, deve redirecionar para `/login`.

### FE-AUTH-RF-012 — Estado dos formulários

Cada formulário DEVE impedir envios duplicados, indicar carregamento e manter
mensagens associadas aos campos ou ao formulário correto.

## Conteúdo mínimo das páginas

### Login

- logo do Minha Carteira;
- título “Entrar na sua conta”;
- campo “E-mail ou nome de usuário”;
- campo “Senha” com controle de visibilidade;
- botão “Entrar”;
- link “Esqueci minha senha”;
- link “Criar conta”.

### Cadastro

- logo e título “Criar sua conta”;
- campos de nome, nome de usuário, e-mail, telefone, senha e confirmação;
- orientação de senha compatível com a política aprovada no backend;
- botão “Criar conta”;
- link “Já tenho uma conta”.

### Solicitação de recuperação

- título “Recuperar senha”;
- explicação curta sobre o link enviado por e-mail;
- campo “E-mail”;
- botão “Enviar link de recuperação”;
- confirmação neutra;
- link “Voltar para o login”.

### Nova senha

- título “Definir nova senha”;
- campos “Nova senha” e “Confirmar nova senha”;
- controles de visibilidade independentes;
- botão “Redefinir senha”;
- estado seguro para token ausente ou inválido;
- link para solicitar outro link.

## Critérios de aceitação

- [ ] As quatro rotas públicas existem no App Router.
- [ ] Login envia `identifier` e `password` sem normalizar a senha.
- [ ] Login não diferencia publicamente os motivos de credencial inválida.
- [ ] Cadastro não envia `passwordConfirmation` nem campos internos.
- [ ] Cadastro bem-sucedido termina na tela de login, sem sessão automática.
- [ ] Solicitação de recuperação sempre mostra a confirmação neutra após 202.
- [ ] Redefinição usa o token da URL sem persistir ou exibi-lo.
- [ ] Token ausente impede o envio da nova senha.
- [ ] Redefinição bem-sucedida termina na tela de login.
- [ ] Chamadas de autenticação enviam cookies com `credentials: "include"`.
- [ ] Nenhum token é salvo em storage acessível por JavaScript.
- [ ] Refresh é tentado no máximo uma vez por requisição.
- [ ] Endpoints públicos de autenticação nunca iniciam refresh automático.
- [ ] A página de nova senha remove o token da barra de endereço após capturá-lo.
- [ ] A página de nova senha usa `no-store` e
  `Referrer-Policy: no-referrer`.
- [ ] Botões não permitem envio duplicado.
- [ ] Erros são anunciados de forma acessível e escritos em português.
- [ ] Layout funciona em viewport móvel e desktop sem rolagem horizontal.
- [ ] Usuário autenticado não permanece nas páginas públicas de autenticação.

## Dependências

- endpoints de autenticação e cadastro definidos no backend;
- contrato de erros HTTP compartilhado;
- React Hook Form, Zod e `@hookform/resolvers`, já instalados;
- TanStack React Query, já instalado;
- `react-hot-toast`, já instalado;
- componentes existentes do shadcn/ui;
- logo em `frontend/public/logo.png`;
- tokens visuais do `DESIGN.md`.

## Decisões confirmadas

- login aceita e-mail ou nome de usuário;
- cadastro recebe nome de usuário, nome, e-mail, telefone e senha;
- recuperação usa somente o token presente no link enviado pelo Resend;
- não existe código numérico;
- redefinição não inicia sessão automaticamente;
- cadastro e redefinição redirecionam para o login;
- autenticação usa cookies `HttpOnly`.

## Decisões pendentes

- política final de senha exibida nos formulários;
- formato e máscara final do telefone;
- nomes e atributos finais dos cookies;
- estratégia CSRF e cabeçalhos exigidos pelo backend;
- topologia de frontend e API para definir a guarda da sessão;
- organização da área privada em route group ou shell por página;
- texto final e composição visual das páginas;
- ferramenta de testes de componentes ou navegador, caso seja adicionada;
- comportamento da URL originalmente solicitada após novo login.

## Documentação relacionada

- `backend/.specs/features/auth/feature.md`;
- `backend/.specs/features/auth/design.md`;
- `backend/.specs/features/users/feature.md`;
- `DESIGN.md`.
