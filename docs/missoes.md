# Missões da disciplina → onde cada uma está implementada

Mapa para quem for avaliar o projeto: cada linha liga uma entrega da
disciplina ao arquivo que a implementa e, quando existe, ao teste que a
verifica.

Convenção: caminhos são relativos à raiz do repositório.

Aluno: Lucas Ferreira da Silva — RA 129733.

---

## Sprint 1 — API inicial com dados em memória

| Item | Onde |
|------|------|
| Servidor Express respondendo em uma porta | [`server.js`](../server.js) |
| Lista de restaurantes | evoluiu para [`src/modules/restaurants/restaurant.service.js`](../src/modules/restaurants/restaurant.service.js) |
| Decisão registrada | [`docs/adr/ADR-001-armazenar-restaurantes-em-memoria.md`](adr/ADR-001-armazenar-restaurantes-em-memoria.md) (status: superada) |

## Sprint 2 — Cadastro e consulta de restaurantes

| Item | Onde | Teste |
|------|------|-------|
| `GET /restaurants` | [`restaurant.routes.js`](../src/modules/restaurants/restaurant.routes.js) | `GET /restaurants é público e lista os restaurantes` |
| `POST /restaurants` | [`restaurant.controller.js`](../src/modules/restaurants/restaurant.controller.js) | `POST /restaurants grava o dono (userId) do restaurante` |
| Validação da entrada | [`src/shared/validators.js`](../src/shared/validators.js) | `tests/validators.test.js` (12 casos) |
| Interface web consumindo a API | [`public/index.html`](../public/index.html), [`public/js/app.js`](../public/js/app.js) | — |

## Sprint 3 — Persistência com PostgreSQL + Prisma

| Item | Onde | Teste |
|------|------|-------|
| Modelo de dados | [`prisma/schema.prisma`](../prisma/schema.prisma) | `tests/schema.test.js` |
| Migrations | [`prisma/migrations/`](../prisma/migrations/) | `as colunas de cada tabela batem com os campos do schema` |
| Conexão única com o banco | [`src/database/prisma.js`](../src/database/prisma.js) | — |
| Dados iniciais | [`prisma/seed.js`](../prisma/seed.js) | — |
| Banco de desenvolvimento | [`docker-compose.yml`](../docker-compose.yml) | — |
| Decisão registrada | [`ADR-002`](adr/ADR-002-persistencia-com-postgresql.md) | `o provider do migration_lock.toml é o mesmo do datasource` |

## Sprint 4 — Refatoração para arquitetura em camadas

| Item | Onde |
|------|------|
| `server.js` só liga o servidor | [`server.js`](../server.js) |
| `app.js` configura a aplicação | [`src/app.js`](../src/app.js) |
| Routes → Controller → Service → Database | [`src/modules/`](../src/modules/) |
| Decisão registrada | [`ADR-003`](adr/ADR-003-arquitetura-em-camadas.md) |
| Diagramas | [`docs/architecture/c4-model.md`](architecture/c4-model.md) |

## Sprint 5 — Autenticação com JWT

| Item | Onde | Teste |
|------|------|-------|
| `POST /auth/register` com hash bcrypt | [`auth.service.js`](../src/modules/auth/auth.service.js) | `a senha é gravada como hash bcrypt, nunca em texto puro` |
| `POST /auth/login` emitindo o token | [`auth.service.js`](../src/modules/auth/auth.service.js) | `POST /auth/login devolve um token HS256 válido` |
| Middleware que protege rotas | [`auth.middleware.js`](../src/modules/auth/auth.middleware.js) | `GET /auth/me exige token e devolve o usuário autenticado` |
| `GET /auth/me` | [`auth.routes.js`](../src/modules/auth/auth.routes.js) | idem |
| Decisão registrada | [`ADR-004`](adr/ADR-004-autenticacao-com-jwt.md) | — |

## Sprint 6 — Versionamento, documentação e decisão sobre eventos

| Item | Onde | Teste |
|------|------|-------|
| Repositório no GitHub, com CI | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | — |
| Diagramas C4 (contexto, contêineres, componentes) | [`docs/architecture/c4-model.md`](architecture/c4-model.md) | — |
| Decisão sobre arquitetura orientada a eventos | [`ADR-005`](adr/ADR-005-comunicacao-direta-sem-eventos.md) | — |
| Cenário da ADR-005 implementado (simulado com log) | [`notification.service.js`](../src/modules/notifications/notification.service.js) | `o cadastro dispara as três reações previstas na ADR-005` |
| Tag da V1 | `v1.0.0` | — |

---

## Atividade 6 — Serviço compartilhado de e-mail

| Item | Onde | Teste |
|------|------|-------|
| Serviço genérico `sendEmail({ to, toName, subject, header, body, footer })` (API do MailerSend); HTML montado internamente por `buildHtml` | [`email.service.js`](../src/shared/email.service.js) | `tests/email.test.js` |
| Credenciais no `.env` | [`.env.example`](../.env.example) | `tests/env.test.js` |
| E-mail de boas-vindas **e** aviso ao comercial, pela mesma `sendEmail`, sem derrubar o cadastro | [`notification.service.js`](../src/modules/notifications/notification.service.js) | `falha no provedor NÃO derruba o cadastro` |
| Registro de atividade **persistido** (tabela `Activity`) | [`activity.service.js`](../src/shared/activity.service.js) | `tests/activity.test.js`, `a atividade é PERSISTIDA na tabela Activity` |
| Boas-vindas e comercial usam a MESMA função | [`notification.service.js`](../src/modules/notifications/notification.service.js) | `boas-vindas e aviso comercial usam a MESMA sendEmail` |
| Decisão do serviço de e-mail | [`ADR-008`](adr/ADR-008-servico-compartilhado-de-email.md) | — |

## Atividade 7 — Cardápio e processamento de imagens

| Item | Onde | Teste |
|------|------|-------|
| Modelo `Dish` (1 restaurante : N pratos) e migration | [`schema.prisma`](../prisma/schema.prisma), [`migration`](../prisma/migrations/20261112120000_criar_tabela_dishes/migration.sql) | `tests/schema.test.js` |
| Módulo `dishes` (routes, controller, service) | [`src/modules/dishes/`](../src/modules/dishes/) | `tests/dishes.test.js` |
| `POST` / `GET /restaurants/:restaurantId/dishes` (POST protegido, só o dono) | [`dish.routes.js`](../src/modules/dishes/dish.routes.js) | `cadastrar prato exige autenticação e ser o dono` |
| `GET` / `PUT` / `DELETE /dishes/:id` (PUT e DELETE só o dono; DELETE apaga a imagem) | [`dish.routes.js`](../src/modules/dishes/dish.routes.js) | `PUT /dishes/:id atualiza...`, `DELETE /dishes/:id exclui...` |
| Interface com cardápio, upload de imagem e foto de perfil | [`public/`](../public/) | `tests/frontend.test.js` |
| Foto de perfil (`POST /auth/me/image`, pasta `profiles`) | [`auth.service.js`](../src/modules/auth/auth.service.js) | `tests/profile.test.js` |
| Blindagem do Sharp (25 MP, `failOn`, `wx`) | [`image.service.js`](../src/shared/image.service.js) | `imagem acima de 25 megapixels é recusada` |
| Upload com Multer (5 MB; JPEG, PNG, WebP) | [`upload.js`](../src/middlewares/upload.js) | `falhas do upload...` |
| Processamento com Sharp (800 px, WebP) | [`image.service.js`](../src/shared/image.service.js) | `upload reduz para até 800 px...` |
| `POST /dishes/:dishId/image` e imagens servidas em `/uploads` | [`dish.routes.js`](../src/modules/dishes/dish.routes.js), [`app.js`](../src/app.js) | `a imagem otimizada abre pelo navegador...` |
| Falha no upload não apaga o prato | [`dish.service.js`](../src/modules/dishes/dish.service.js) | `falha no upload NÃO apaga o prato...` |
| Comparação original × otimizada (Parte 15) | [`atividade-07-comparacao-de-imagens.md`](atividade-07-comparacao-de-imagens.md), [`scripts/compare-image.js`](../scripts/compare-image.js) | — |
| ADR do processamento de imagens | [`ADR-007`](adr/ADR-007-processamento-de-imagens-dentro-da-api.md), [`ADR-009`](adr/ADR-009-atividade-persistida-e-foto-de-perfil.md) | — |

Respostas do "Pense como arquiteto" das Missões 1 a 5: [`respostas-missoes.md`](respostas-missoes.md). Evidências e pendências de validação: [`validacao.md`](validacao.md).

Observação sobre o enunciado: os arquivos compartilhados ficam em `src/shared/`
(e o middleware de upload em `src/middlewares/upload.js`), e não em
`src/modules/shared/`, para manter a mesma estrutura adotada desde a
Atividade 4 (camadas) e na Atividade 6 (e-mail).

## Aula 8 — Serverless e FaaS (conceitual)

| Item | Onde |
|------|------|
| Comparação: dentro da API × serviço independente × Serverless/FaaS (cold start, trade-offs) | [`ADR-007`](adr/ADR-007-processamento-de-imagens-dentro-da-api.md) |
| Análise dos cenários A, B e C pelos atributos de qualidade | [`ADR-007`, seção "Análise por cenário"](adr/ADR-007-processamento-de-imagens-dentro-da-api.md) |
| Função de otimização com Sharp executável isoladamente | [`scripts/compare-image.js`](../scripts/compare-image.js) usa o `image.service.js` fora da API |

---

## Manutenção de setembro/2026 (correções após auditoria)

Detalhamento completo em [`docs/manutencao.md`](manutencao.md).

| Item | Onde | Teste |
|------|------|-------|
| Erros sempre em JSON (404, 400, 413, 415, 500) | [`src/middlewares/error-handler.js`](../src/middlewares/error-handler.js) | `tests/api.test.js` (12 casos) |
| Sem `X-Powered-By` | [`src/app.js`](../src/app.js) | `o header X-Powered-By não é enviado em nenhuma resposta` |
| Validação de ambiente / falha rápida | [`src/config/env.js`](../src/config/env.js) | `tests/env.test.js` |
| `algorithms: ["HS256"]` | [`auth.middleware.js`](../src/modules/auth/auth.middleware.js) | `token com alg "none" é recusado` |
| Cabeçalhos de segurança (helmet + CSP) | [`src/app.js`](../src/app.js) | `os cabeçalhos de segurança do helmet estão presentes` |
| Rate limit em `/auth` | [`src/middlewares/rate-limit.js`](../src/middlewares/rate-limit.js) | `tests/rate-limit.test.js` |
| `GET /health` | [`health.routes.js`](../src/modules/health/health.routes.js) | `GET /health responde 200 com status ok` |
| `GET /restaurants/:id`, `PUT`, `DELETE` | [`restaurant.routes.js`](../src/modules/restaurants/restaurant.routes.js) | `tests/restaurants.test.js` (15 casos) |
| Vínculo restaurante → usuário | [`prisma/schema.prisma`](../prisma/schema.prisma) + migration | `toda relação do schema tem a chave estrangeira correspondente` |
| CSS/JS separados e `sessionStorage` | [`public/css/`](../public/css/), [`public/js/`](../public/js/) | — |
| `.gitattributes` | [`.gitattributes`](../.gitattributes) | — |
| `prisma:check` compatível com Windows | [`scripts/prisma-check.js`](../scripts/prisma-check.js) | — |

---

## Manutenção de setembro/2026 — rodada 2

Detalhamento completo em [`docs/manutencao.md`](manutencao.md), seções 11 a 14.

| Item | Onde | Teste |
|------|------|-------|
| Login não vaza a política de senha (curta = 401, não 400) | [`src/shared/validators.js`](../src/shared/validators.js) (`validateLoginPassword`) | `tests/auth.test.js`, `tests/validators.test.js` |
| `PUT` sem `rating` mantém a nota atual | [`restaurant.controller.js`](../src/modules/restaurants/restaurant.controller.js), [`restaurant.service.js`](../src/modules/restaurants/restaurant.service.js) | `PUT sem rating mantém a nota atual; com rating, atualiza; nota 0 é uma nota` |
| `TRUST_PROXY` (rate limit correto atrás de proxy) | [`src/config/env.js`](../src/config/env.js), [`src/app.js`](../src/app.js) | `tests/rate-limit.test.js`, `tests/env.test.js` |
| `CORS_ORIGIN` (aberto em dev, fechado em produção por padrão) | [`src/config/env.js`](../src/config/env.js), [`src/app.js`](../src/app.js) | `tests/cors.test.js`, `tests/env.test.js` |
| Usuário de demonstração do seed como opt-in (`SEED_DEMO_USER`) | [`prisma/seed.js`](../prisma/seed.js) | — (verificado manualmente; não há teste automatizado do seed) |
| Front-end sem `style` nem handlers inline (conflito com a CSP) | [`public/js/app.js`](../public/js/app.js), [`public/css/styles.css`](../public/css/styles.css) | `tests/frontend.test.js` |
| `prisma:check` restaurado no `package.json` | [`package.json`](../package.json) | — |
| Segundo job de CI com PostgreSQL real (migrations, `prisma:check`, seed 2x, smoke test) | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml), [`scripts/smoke-test.sh`](../scripts/smoke-test.sh) | job `banco` no CI |
| Tag da rodada | `v1.2.0` | — |

---

## Entrega final (nov/2026) — evolução, arquitetura e preparação para publicação

| Item | Onde |
|------|------|
| Evolução da aplicação: cardápio, imagens e foto de perfil na interface | [`public/`](../public/) |
| Evolução da arquitetura: C4 atualizado (pratos, imagens, e-mail, atividade, disco de uploads) | [`docs/architecture/c4-model.md`](architecture/c4-model.md) |
| Decisões novas | [`ADR-009`](adr/ADR-009-atividade-persistida-e-foto-de-perfil.md); atualizações em ADR-007 e ADR-008 |
| Preparação para publicação: Dockerfile, `render.yaml`, `start` com migrate, Prisma em `dependencies` | [`docs/deploy.md`](deploy.md) |
| Smoke test no CI cobrindo pratos, upload, foto de perfil e atividade | [`scripts/smoke-test.sh`](../scripts/smoke-test.sh), [`ci.yml`](../.github/workflows/ci.yml) |
| Respostas das Missões 1 a 5 | [`respostas-missoes.md`](respostas-missoes.md) |
