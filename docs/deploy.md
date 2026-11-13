# Deploy e preparação para publicação

O que existe no repositório para publicar a EasyFood e o que ainda é decisão sua.

## O que já está pronto

| Item | Onde | Observação |
|------|------|------------|
| `@prisma/client` e `prisma` em `dependencies` | `package.json` | Antes estavam em `devDependencies`: `npm ci --omit=dev` não os instalava e a API não subia em produção. |
| `prisma generate` automático | script `postinstall` | Roda em todo `npm install` / `npm ci`. |
| Migrations no início | script `start` = `prisma migrate deploy && node server.js` | `npm run start:app` sobe sem migrar (use se as migrations rodam em outro passo). |
| Imagem Docker | `Dockerfile`, `.dockerignore` | Node 22, usuário não-root, `HEALTHCHECK` em `/health`. |
| Blueprint do Render | `render.yaml` | Web service Docker + PostgreSQL + disco persistente. |
| Health check | `GET /health` | Usado pelo `HEALTHCHECK` e pelo Render. |
| Variáveis de ambiente | `.env.example`, README | `TRUST_PROXY`, `CORS_ORIGIN`, `COOKIE_SECURE` (liga sozinho em produção). |

## Variáveis mínimas em produção

```
DATABASE_URL      string do PostgreSQL gerenciado
JWT_SECRET        mínimo de 32 bytes (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
NODE_ENV          production
TRUST_PROXY       1  (atrás de um proxy reverso, para o rate limit enxergar o IP real)
UPLOADS_DIR       pasta do disco persistente (ex.: /data/uploads)
```

Opcionais: `EMAIL_API_KEY`, `EMAIL_FROM`, `COMMERCIAL_EMAIL` (e-mail real), `CORS_ORIGIN`
(só se houver front-end em outra origem). **Não** ligue `SEED_DEMO_USER` em produção.

## Passo a passo com Docker

```bash
docker build -t easyfood .
docker run -p 3000:3000 --env-file .env -v easyfood-uploads:/app/uploads easyfood
```

O contêiner aplica as migrations pendentes ao iniciar.

## Passo a passo no Render

1. Suba o repositório para o GitHub.
2. No Render: **New → Blueprint** e aponte para o repositório (usa o `render.yaml`).
3. Preencha os segredos pedidos no painel (`EMAIL_API_KEY`, `EMAIL_FROM`, `COMMERCIAL_EMAIL`).
4. Confira `https://<seu-serviço>/health` e `https://<seu-serviço>/docs`.

Disco persistente exige plano pago. No plano gratuito o disco é efêmero e as
imagens somem a cada novo deploy — ver abaixo.

## Imagens: plano para o armazenamento

| Cenário | O que fazer |
|---------|-------------|
| Uma instância, com disco persistente | `UPLOADS_DIR` aponta para o disco. Já funciona. |
| Hospedagem com disco efêmero | Não publique assim para uso real: use disco persistente ou armazenamento de objetos. |
| Mais de uma instância | Migrar para S3 / Cloudflare R2: trocar o destino de gravação em `src/shared/image.service.js` (único arquivo que toca o disco). O banco continua guardando só a URL. |

Decisão e gatilhos: [ADR-007](./adr/ADR-007-processamento-de-imagens-dentro-da-api.md).

## O que NÃO foi verificado

- O `Dockerfile` não foi construído no ambiente em que esta entrega foi preparada
  (sem Docker disponível). O CI tem um passo `docker build` que valida isso no GitHub.
- O `render.yaml` não foi aplicado em uma conta real.
- Nenhum deploy real foi feito.
