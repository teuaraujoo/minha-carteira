# Spec simples — organização do projeto no Trello

## Objetivo e destino

Organizar o projeto Minha Carteira no board existente
[Minha Carteira](https://trello.com/b/eEQXR3sm/minha-carteira), conforme solicitação do usuário.
A organização registra o trabalho; não implementa funcionalidades, aprova
arquitetura, executa migrations ou publica a aplicação.

## Fontes e escopo

Consultar as specs de auth, users, storage, logs e auth-pages, o documento
`estado-atual.md`, o código relacionado e o documento geral do produto.
Priorizar specs específicas e código ao reconciliar documentação antiga.

Criar cards para implementações faltantes, backlog e código com testes ou
validações ainda pendentes. Reunir tarefas equivalentes entre specs, como
AUTH-13 e a integração frontend de redefinição de senha. Funcionalidades
financeiras sem spec detalhada serão cards em backlog, com entrega condicionada
à especificação e aprovação prévias;
ideias pós-MVP serão claramente identificadas como futuras, sem aprovação de
implementação. Não copiar segredos, dados privados ou credenciais para cards.

## Estrutura e classificação

Criar, nesta ordem: Backlog, To do, In progress, To review, Reviewed, Deployed.

- Backlog: futuro, dependências abertas ou especificação ainda necessária.
- To do: trabalho a iniciar na próxima frente, com dependências identificadas.
- In progress: execução efetivamente iniciada, sem presumir progresso.
- To review: código aplicado, aguardando testes, integração ou evidências.
- Reviewed: critérios revisados e aprovados com evidência suficiente.
- Deployed: publicação comprovada no ambiente de destino.

Reutilizar listas/cards existentes se houver equivalência. O board estava vazio
na consulta inicial. Listas podem ficar vazias; não inventar revisão ou deploy.

Cada card de implementação ou backlog terá título e as seções História,
Contexto, Critérios de aceite, Fora do escopo e Relacionados. Cards de validação
podem usar Contexto aplicado, O que testar e Relacionados. Os critérios serão
verificáveis e as dependências apontarão para IDs e links dos cards relacionados.

Aplicar exatamente uma etiqueta de prioridade por card: vermelho = urgente,
amarelo = média, azul = baixa. Reutilizar as etiquetas existentes dessas cores.
A urgência indica bloqueio crítico de segurança/integração da próxima entrega;
não significa incidente de produção. Média corresponde à entrega funcional;
baixa corresponde à evolução futura ou acompanhamento sem bloqueio imediato.
Não definir responsáveis ou prazos sem informação fornecida pelo usuário.

## Passos e aceite da organização

- [x] Identificar board e conferir listas, cards e etiquetas existentes.
- [x] Registrar esta spec antes de qualquer alteração no Trello.
- [x] Inventariar tarefas e revisar duplicações, escopo e evidências.
- [x] Criar as seis listas na ordem solicitada.
- [x] Criar os cards com descrição, estado inicial e prioridade.
- [x] Substituir referências entre cards por links reais.
- [x] Relê-los e verificar listas, cores, estrutura, quantidade e cobertura.
- [x] Registrar abaixo o resultado real, diferenças e limitações.

Aceite: seis listas corretas, todos os cards inventariados representados uma
única vez, prioridade em cada card, estrutura coerente com seu tipo e ausência
de alegações de testes/deploy sem evidência. A publicação dos cards está
autorizada pela solicitação do usuário; não exige nova confirmação.

## Registro de execução

Execução concluída no board identificado: seis listas na ordem solicitada e
37 cards criados, com os links registrados no inventário abaixo. A spec foi
criada antes das alterações no Trello e atualizada após sua execução.

- Backlog: 18 cards; To do: 11; To review: 8.
- In progress, Reviewed e Deployed: zero cards em cada lista.
- Prioridades: 28 etiquetas amarelas e nove azuis. Vermelho reservado a
  urgências; nenhuma foi presumida a partir da documentação consultada.
- Os 29 cards de implementação/backlog usam a estrutura completa; os oito
  cards de validação descrevem contexto aplicado, o que testar e relacionados.
- Os 116 vínculos entre cards apontam para cards existentes no mesmo board.
- Releitura confirmou títulos, listas, descrições e uma prioridade por card;
  não foram criados prazos, responsáveis ou alegações de conclusão/deploy.
- A revisão independente conferiu inventário, cobertura e estrutura. Seu
  ajuste sobre o teste HTTP de cadastro público foi incorporado. A integração
  real com R2 ficou explícita no card de validação de storage.

Foram reutilizadas as etiquetas coloridas existentes, sem renomeá-las; seus
significados constam nas descrições dos cards e nesta spec. Não houve alteração
de código, execução de testes, migrations, envio de e-mail ou deploy nesta
organização. Os testes solicitados nos cards continuam pendentes.

As ferramentas do Trello ficaram disponíveis durante a descoberta do plugin;
não foi necessário recorrer ao navegador. Documentos e pastas preexistentes,
incluindo `estado-atual.md`, `.postman/` e `postman/`, foram preservados.
Nenhum commit ou push foi realizado nesta tarefa.

## Inventário planejado antes da criação dos cards

São 37 cards: 18 em Backlog, 11 em To do e 8 em To review.
In progress, Reviewed e Deployed permanecem vazias por ausência de evidências.
Nenhuma urgência foi identificada; vermelho está reservado para urgências reais.
A prioridade média não transforma backlog em implementação aprovada.

Os cinco cards financeiros agrupam especificação e entrega planejada de cada
módulo. A implementação depende de aprovação da spec e das decisões técnicas;
o agrupamento evita apresentar o MVP financeiro como concluído ou omiti-lo.

| ID | Título | Lista inicial | Prioridade |
| --- | --- | --- | --- |
| [ORG-01](https://trello.com/c/DeHuQWBX) | Reconciliar specs e documentação com o estado real | To do | Amarelo |
| [FE-DEC-01](https://trello.com/c/1GfoS75C) | Fechar decisões restantes da navegação e apresentação de autenticação | To do | Amarelo |
| [FE-AUTH-01](https://trello.com/c/jwt3sqUD) | Implementar cliente HTTP, contratos e providers de autenticação | To do | Amarelo |
| [FE-AUTH-02](https://trello.com/c/AdRplXKX) | Criar layout público e componentes de autenticação | To do | Amarelo |
| [FE-AUTH-03](https://trello.com/c/bn2lcdzC) | Implementar tela de login | To do | Amarelo |
| [FE-AUTH-04](https://trello.com/c/vzGLHi4h) | Implementar tela de cadastro | To do | Amarelo |
| [FE-AUTH-05](https://trello.com/c/P5NUXHQG) | Implementar solicitação de recuperação de senha | To do | Amarelo |
| [FE-AUTH-06](https://trello.com/c/aTDkqHy9) | Implementar definição de nova senha e redirect para login | To do | Amarelo |
| [FE-AUTH-07](https://trello.com/c/I7AzputE) | Proteger rotas privadas e integrar logout e renovação de sessão | To do | Amarelo |
| [FE-AUTH-08](https://trello.com/c/QNaK6gVv) | Validar autenticação integrada e documentar fluxos frontend | To do | Amarelo |
| [OPS-TOKEN](https://trello.com/c/lcNwLOMM) | Definir e validar proteção do link de recuperação na hospedagem | Backlog | Amarelo |
| [VAL-AUTH-PG](https://trello.com/c/kjGRHzAO) | Validar persistência e transações de autenticação em PostgreSQL | To review | Amarelo |
| [VAL-USERS-PG](https://trello.com/c/kOp8o7mY) | Validar persistência e ciclo de vida de usuários em PostgreSQL | To review | Amarelo |
| [VAL-STORAGE-PG](https://trello.com/c/iRcH5hhQ) | Validar persistência e substituição contextual de arquivos | To review | Amarelo |
| [VAL-AUTH-HTTP](https://trello.com/c/ehrJa8W4) | Validar sessões, CSRF, recuperação e reativação por HTTP integrado | To review | Amarelo |
| [VAL-RESET-HTTP](https://trello.com/c/qyi4aPSz) | Validar recuperação de senha e revogação de sessões por HTTP | To review | Amarelo |
| [VAL-USERS-HTTP](https://trello.com/c/ZsK0B6OM) | Validar perfil, desativação e upload autenticado via HTTP | To review | Amarelo |
| [VAL-RESEND](https://trello.com/c/j4Ofm8Jv) | Validar entrega real dos e-mails pelo Resend | To review | Amarelo |
| [VAL-SERVER](https://trello.com/c/opGG5Iwk) | Concluir compilação e regressão da inicialização do servidor | To review | Amarelo |
| [LOG-RECON](https://trello.com/c/HUynm9Bj) | Reconciliar LOG-06 a LOG-09 com os serviços e logs atuais | To do | Amarelo |
| [USR-07](https://trello.com/c/XLRchWSh) | Planejar e implementar limpeza de usuários inativos após 30 dias | Backlog | Azul |
| [AUTH-15](https://trello.com/c/Y2stHoHy) | Expirar solicitações e desafios vencidos em lotes | Backlog | Azul |
| [FIN-ACCOUNTS](https://trello.com/c/2Zuf5kgJ) | Especificar e entregar gerenciamento de contas financeiras do MVP | Backlog | Amarelo |
| [FIN-CATEGORIES](https://trello.com/c/9MTUGpEd) | Especificar e entregar categorias de receitas e despesas | Backlog | Amarelo |
| [FIN-TRANSACTIONS](https://trello.com/c/ELBAvd1E) | Especificar e entregar receitas, despesas e confirmação de pendências | Backlog | Amarelo |
| [FIN-RECURRING](https://trello.com/c/g8u4698o) | Especificar e entregar recorrências e geração sem duplicidade | Backlog | Amarelo |
| [FIN-DASHBOARD](https://trello.com/c/k5P7ayUo) | Especificar e entregar dashboard financeiro mensal | Backlog | Amarelo |
| [FE-USR-01](https://trello.com/c/FXsW2tFj) | Especificar e integrar perfil, imagem e desativação no frontend | Backlog | Amarelo |
| [FE-REACT-01](https://trello.com/c/2QdCTWQ3) | Especificar e integrar a interface de reativação de conta por link | Backlog | Amarelo |
| [FUT-TELEGRAM](https://trello.com/c/htg1Hd7Z) | Pós-MVP: especificar integração restrita com Telegram | Backlog | Azul |
| [FUT-FRIENDS](https://trello.com/c/fgSmdJiT) | Pós-MVP: especificar amizades e privacidade | Backlog | Azul |
| [FUT-GOALS](https://trello.com/c/CpsY68Kd) | Pós-MVP: especificar metas individuais e contribuições manuais | Backlog | Azul |
| [FUT-GROUPS](https://trello.com/c/Q97pfZ76) | Pós-MVP: especificar grupos de economia e contribuições | Backlog | Azul |
| [FUT-CAPABILITIES](https://trello.com/c/uM9YCyXt) | Futuro: especificar administração de capabilities e verificação de e-mail | Backlog | Azul |
| [FUT-RETENTION](https://trello.com/c/8Yxk96no) | Futuro: definir retenção e anonimização de auditoria de autenticação | Backlog | Azul |
| [QA-MVP](https://trello.com/c/hOtAj2LJ) | Planejar e validar qualidade transversal do MVP financeiro | Backlog | Amarelo |
| [OPS-01](https://trello.com/c/5Yl70abs) | Planejar hospedagem, configuração segura, backup e publicação | Backlog | Azul |
