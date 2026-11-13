# Arquitetura da EasyFood — Modelo C4

Este documento descreve a arquitetura da EasyFood nos três primeiros níveis do [modelo C4](https://c4model.com/), do mais geral ao mais detalhado. O quarto nível (Code) é o próprio código-fonte em [`src/`](../../src/).

Os diagramas usam [Mermaid](https://mermaid.js.org/), que o GitHub renderiza automaticamente.

As decisões por trás desta arquitetura estão registradas nos [ADRs](../adr/):

- [ADR-002](../adr/ADR-002-persistencia-com-postgresql.md) — PostgreSQL como banco de dados
- [ADR-003](../adr/ADR-003-arquitetura-em-camadas.md) — monólito modular em camadas
- [ADR-004](../adr/ADR-004-autenticacao-com-jwt.md) — autenticação com JWT
- [ADR-005](../adr/ADR-005-comunicacao-direta-sem-eventos.md) — comunicação direta entre módulos, sem eventos por ora
- [ADR-007](../adr/ADR-007-processamento-de-imagens-dentro-da-api.md) — processamento de imagens dentro da API e plano de armazenamento
- [ADR-008](../adr/ADR-008-servico-compartilhado-de-email.md) — serviço compartilhado de e-mail
- [ADR-009](../adr/ADR-009-atividade-persistida-e-foto-de-perfil.md) — atividade persistida e foto de perfil

---

## Nível 1 — Contexto

**Quem usa o sistema e com o que ele se relaciona?**

A EasyFood é usada por pessoas que consultam restaurantes e cardápios e por donos de restaurante (usuários autenticados) que se cadastram, montam o cardápio e enviam imagens. A plataforma envia e-mails por um provedor externo (MailerSend).

```mermaid
flowchart TB
    usuario["👤 Usuário<br/>Consulta restaurantes e cardápios"]
    dono["👤 Dono de restaurante<br/>Cria conta, cadastra restaurante,<br/>pratos, imagens e foto de perfil"]
    easyfood["EasyFood<br/>Restaurantes, cardápio com imagens otimizadas,<br/>login e notificações por e-mail"]
    mailer["MailerSend<br/>[sistema externo]<br/>Entrega e-mails"]

    usuario -->|"Consulta"| easyfood
    dono -->|"Autentica-se e gerencia"| easyfood
    easyfood -->|"HTTPS: boas-vindas e aviso comercial"| mailer

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef system fill:#1168bd,stroke:#0b4884,color:#ffffff
    classDef external fill:#999999,stroke:#6b6b6b,color:#ffffff
    class usuario,dono person
    class easyfood system
    class mailer external
```

---

## Nível 2 — Contêineres

**Quais aplicações e armazenamentos formam o sistema?**

A interface web é servida pelo próprio Express (`express.static`), então interface e API compartilham a mesma origem e o mesmo deploy. As imagens otimizadas ficam em um **disco de uploads** (`UPLOADS_DIR`) servido em `/uploads`; em produção esse disco precisa ser persistente (ver [`docs/deploy.md`](../deploy.md) e a ADR-007). Em desenvolvimento, o PostgreSQL roda via [`docker-compose.yml`](../../docker-compose.yml); em produção, pelo [`Dockerfile`](../../Dockerfile) e pelo [`render.yaml`](../../render.yaml).

```mermaid
flowchart TB
    usuario["👤 Usuário<br/>Usa o sistema pelo navegador"]
    mailer["MailerSend<br/>[sistema externo]"]

    subgraph easyfood["Sistema EasyFood"]
        direction TB
        web["Interface web<br/>[HTML, CSS e JavaScript — public/]<br/>Restaurantes, cardápio, upload de imagem,<br/>login, foto de perfil"]
        api["API EasyFood<br/>[Node.js + Express 5]<br/>Autenticação JWT, restaurantes, cardápio,<br/>processamento de imagens (Sharp), e-mail"]
        db[("PostgreSQL<br/>[banco relacional]<br/>Tabelas User, Restaurant, Dish e Activity")]
        disk[("Disco de uploads<br/>[sistema de arquivos]<br/>uploads/dishes e uploads/profiles (WebP)")]
    end

    usuario -->|"Acessa"| web
    web -->|"HTTP/JSON e multipart<br/>/restaurants, /dishes, /auth/*"| api
    api -.->|"Entrega estáticos e /uploads"| web
    api -->|"Prisma ORM<br/>SQL sobre TCP"| db
    api -->|"Grava e remove imagens"| disk
    api -->|"HTTPS (fetch)"| mailer

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef container fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef external fill:#999999,stroke:#6b6b6b,color:#ffffff
    class usuario person
    class web,api,db,disk container
    class mailer external
```

---

## Nível 3 — Componentes (API EasyFood)

**Como a API está organizada internamente?**

A API segue o fluxo `routes → controller → service → database` (ADR-003). O middleware de autenticação é reaproveitado por qualquer módulo que precise proteger rotas (ADR-004). Três serviços **compartilhados** (`src/shared/`) atendem a mais de um módulo: `image.service` (Sharp), `email.service` (MailerSend) e `activity.service` (tabela `Activity`).

Os componentes transversais — configuração, middlewares e tratamento de erro — foram acrescentados na manutenção de setembro/2026 (ver [`docs/manutencao.md`](../manutencao.md)). Eles não alteram o fluxo das camadas: apenas cercam a aplicação.

```mermaid
flowchart TB
    web["Interface web<br/>[navegador]"]
    db[("PostgreSQL")]
    disk[("Disco de uploads")]
    mailer["MailerSend<br/>[externo]"]

    subgraph api["API EasyFood [Node.js + Express]"]
        direction TB
        server["server.js<br/>Valida o ambiente, liga o servidor e encerra em ordem"]
        config["config/env.js<br/>Carrega e valida as variáveis de ambiente"]
        app["app.js<br/>helmet, CORS, JSON com limite, estáticos, /uploads e rotas"]

        subgraph middlewares["Middlewares transversais"]
            reqMw["request.js<br/>Normaliza req.body; JSON, exceto uploads"]
            rateMw["rate-limit.js<br/>Limita tentativas em /auth"]
            uploadMw["upload.js<br/>Multer: 1 imagem, 5 MB, JPEG/PNG/WebP, em memória"]
            errMw["error-handler.js<br/>404 e erros sempre em JSON"]
        end

        subgraph auth["Módulo auth"]
            authRoutes["auth.routes.js<br/>register, login, logout, me, me/image"]
            authCtrl["auth.controller.js"]
            authSvc["auth.service.js<br/>bcrypt, JWT, perfil e foto de perfil"]
            authMw["auth.middleware.js + csrf.middleware.js<br/>Valida o token e popula req.user"]
        end

        subgraph restaurants["Módulo restaurants"]
            restRoutes["restaurant.routes.js"]
            restCtrl["restaurant.controller.js"]
            restSvc["restaurant.service.js<br/>Regra de posse (só o dono altera)"]
        end

        subgraph dishes["Módulo dishes"]
            dishRoutes["dish.routes.js<br/>CRUD de pratos + POST /dishes/:id/image"]
            dishCtrl["dish.controller.js"]
            dishSvc["dish.service.js<br/>Posse via restaurante; imagem do prato"]
        end

        subgraph notif["Módulo notifications"]
            notifSvc["notification.service.js<br/>Cenário da ADR-005: boas-vindas,<br/>atividade e aviso ao comercial"]
        end

        subgraph shared["Serviços compartilhados (src/shared)"]
            imgSvc["image.service.js<br/>Sharp: 800 px, WebP, limite de 25 MP"]
            emailSvc["email.service.js<br/>sendEmail(to, toName, subject, header, body, footer)"]
            actSvc["activity.service.js<br/>Grava action + details em Activity"]
        end

        health["health.routes.js<br/>GET /health"]
        prisma["database/prisma.js<br/>Instância única do PrismaClient"]
    end

    web -->|"HTTP/JSON e multipart"| app
    server --> config
    server --> app
    app --> reqMw
    app --> health
    app --> authRoutes
    app --> restRoutes
    app --> dishRoutes
    app --> errMw
    authRoutes --> rateMw

    authRoutes --> authMw
    authRoutes --> uploadMw
    authRoutes --> authCtrl
    authCtrl --> authSvc
    authSvc --> prisma
    authSvc --> imgSvc

    restRoutes --> authMw
    restRoutes --> restCtrl
    restCtrl --> restSvc
    restSvc --> prisma
    restSvc -->|"chamada direta (ADR-005)"| notifSvc

    dishRoutes --> authMw
    dishRoutes --> uploadMw
    dishRoutes --> dishCtrl
    dishCtrl --> dishSvc
    dishSvc -->|"getOwnedRestaurant"| restSvc
    dishSvc --> prisma
    dishSvc --> imgSvc

    notifSvc --> emailSvc
    notifSvc --> actSvc
    actSvc --> prisma

    prisma -->|"SQL"| db
    imgSvc -->|"grava / remove"| disk
    emailSvc -->|"HTTPS"| mailer

    classDef component fill:#85bbf0,stroke:#5d82a8,color:#000000
    classDef external fill:#438dd5,stroke:#2e6295,color:#ffffff
    class server,config,app,reqMw,rateMw,uploadMw,errMw,health,authRoutes,authCtrl,authSvc,authMw,restRoutes,restCtrl,restSvc,dishRoutes,dishCtrl,dishSvc,notifSvc,imgSvc,emailSvc,actSvc,prisma component
    class web,db,disk,mailer external
```

---

## Nível 4 — Código

O nível 4 é o próprio código em [`src/`](../../src/). Para complementar, o diagrama abaixo mostra o caminho de uma requisição protegida: o cadastro de um restaurante.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuário (navegador)
    participant R as restaurant.routes
    participant M as auth.middleware
    participant C as restaurant.controller
    participant V as validators
    participant S as restaurant.service
    participant P as Prisma
    participant DB as PostgreSQL
    participant N as notification.service

    U->>R: POST /restaurants com Authorization: Bearer TOKEN
    R->>M: authenticate
    alt token ausente, inválido ou expirado
        M-->>U: 401 Unauthorized
    else token válido
        M->>C: next() com req.user preenchido
        C->>V: validateRestaurant(name, category, rating)
        alt dados inválidos
            V-->>C: lista de erros
            C-->>U: 400 Bad Request
        else dados válidos
            V-->>C: dados normalizados (rating vira 0 se ausente)
            C->>S: createRestaurant(dados, req.user)
            S->>P: restaurant.create({ ...dados, userId: req.user.id })
            P->>DB: INSERT
            DB-->>P: registro criado
            P-->>S: restaurante (com o dono)
            S-)N: notificar(restaurante) — chamada direta, sem esperar (ADR-005)
            S-->>C: restaurante
            C-->>U: 201 Created
        end
    end

    Note over N: grava a atividade na tabela Activity e envia (ou simula<br/>em log, sem provedor) boas-vindas e aviso ao comercial
```

---

## Manutenção

Atualize estes diagramas quando uma decisão arquitetural mudar a estrutura do sistema (novo módulo, novo contêiner, novo serviço externo) e registre a decisão em um novo ADR.
