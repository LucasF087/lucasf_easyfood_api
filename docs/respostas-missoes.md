# Respostas — "Pense como arquiteto" (Missões 1 a 5)

Respostas escritas a partir do que o projeto **realmente** faz hoje. O texto completo
das perguntas dos slides não está nos arquivos desta entrega: as respostas seguem os
temas de cada missão. Se a numeração do enunciado for diferente, mantenha o conteúdo
e ajuste só os números.

Aluno: Lucas Ferreira da Silva — RA 129733.

## Missão 1 — Cadastro de restaurantes

1. **O que a API precisa fazer?** Receber os dados de um restaurante, validá-los, criar o registro e permitir listar.
2. **Qual a nova rota?** `POST /restaurants`. POST porque cria um recurso novo; `GET /restaurants` lista.
3. **Que dados chegam?** JSON com `name`, `category` e `rating`. `name` é obrigatório; `rating` é opcional e vai de 0 a 5.
4. **Como o Express lê o corpo?** O cliente envia `Content-Type: application/json` e o `express.json()` preenche `req.body`. Outro tipo de conteúdo recebe `415`.
5. **Onde o dado ficava?** Na primeira versão, num array em memória (ADR-001). Hoje, no PostgreSQL.
6. **Algum componente novo na arquitetura?** Nenhum: a rota nova usa o mesmo servidor HTTP. O que mudou o desenho foi a persistência (Missão 2).
7. **Decisão e trade-off:** começar em memória foi simples e rápido, mas perde tudo ao reiniciar. Registrado na ADR-001 (superada pela ADR-002).

## Missão 2 — Persistência

1. **Qual banco?** PostgreSQL: relacional, com integridade e chaves estrangeiras, adequado a usuários, restaurantes e pratos relacionados (ADR-002).
2. **O que muda no código?** O `push` no array vira `prisma.restaurant.create`; a listagem vira `findMany`.
3. **Dependências novas:** `@prisma/client` e `prisma` (ORM e migrations). Em produção as duas são necessárias, por isso ficam em `dependencies`.
4. **Onde ficam as chamadas?** Primeiro no `server.js`; depois da Missão 4, nos Services, com a conexão única em `src/database/prisma.js`.
5. **Como fica o desenho?** De Cliente → API → array para Cliente → API → Prisma → PostgreSQL (C4, nível 2).
6. **Ganhos e custos:** dados duráveis e compartilhados; em troca, um serviço a mais para operar (credenciais, backup, migrations).
7. **Como provar a persistência?** Reiniciar a API e confirmar que o registro continua lá; o smoke test no CI roda contra um PostgreSQL real.

## Missão 3 — PostgreSQL e Prisma

1. **O que se resolveu?** A perda de dados a cada reinício.
2. **Por que PostgreSQL?** Estrutura relacional e relações futuras (usuário → restaurante → prato).
3. **Quem faz o quê?** O Prisma traduz as chamadas do código em SQL; as migrations versionam o esquema (`prisma/migrations`); a persistência é do PostgreSQL.
4. **E se o banco cair?** Sem banco, o servidor não sobe; com a API no ar e o banco indisponível, a rota devolve `500` em JSON, sem expor detalhes internos (error handler central).
5. **Custos assumidos:** infraestrutura, configuração (`DATABASE_URL`), latência de I/O.
6. **O que o desenho deve mostrar?** Prisma e PostgreSQL como componentes — ver `docs/architecture/c4-model.md`.

## Missão 4 — Camadas

1. **Por que separar?** Para não concentrar tudo no `server.js` e facilitar entender, testar e trocar partes (ADR-003).
2. **Papel do `server.js`:** valida o ambiente, liga o HTTP e encerra de forma ordenada. O `app.js` monta middlewares e rotas.
3. **Routes / Controller / Service:** a rota liga método e caminho aos middlewares; o controller valida a entrada e escolhe a resposta HTTP; o service aplica a regra de negócio.
4. **Banco:** só o Service fala com `database/prisma.js`.
5. **Por que o Service não conhece `req`/`res`?** Para ser reutilizável (scripts, testes, outros módulos) sem depender de HTTP. É assim que `dishes` reutiliza a regra de posse de `restaurants`.
6. **Por que a rota não acessa o Prisma?** Para não misturar roteamento com persistência.
7. **A refatoração mudou o comportamento?** Não: `GET` e `POST` seguem iguais; o `POST` passou a exigir login na Missão 5.
8. **Custo:** mais arquivos e mais chamadas entre camadas; ganho: responsabilidades localizadas.
9. **Módulo de autenticação:** implementado; decisão e alternativas na ADR-004.

## Missão 5 — Autenticação

1. **Fluxo:** cadastro → bcrypt → hash no banco → login → `bcrypt.compare` → JWT (HS256, 1 dia) → middleware valida → controller.
2. **O que é público e o que é protegido?** `GET /restaurants` e o cardápio (GET) são públicos; criar, alterar e excluir exigem token; só o dono altera o que é dele (`403` para outro usuário).
3. **Códigos:** `201` cadastro; `409` e-mail repetido; `401` credencial errada ou token ausente/inválido/expirado; `400` entrada inválida; `403` não é o dono.
4. **Por que mensagem única no login?** Para não revelar quais e-mails existem. A senha curta também dá `401`, não `400`.
5. **Onde guardar o token?** Evoluiu para cookie httpOnly com proteção CSRF (ADR-006); o header `Authorization: Bearer` continua aceito para Postman e scripts.
6. **Trade-off do JWT:** não há refresh token nem revogação; `logout` apaga o cookie, mas o token continua válido até expirar (limitação registrada no README).
