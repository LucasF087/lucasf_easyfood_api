# EasyFood — imagem de produção.
#
#   docker build -t easyfood .
#   docker run -p 3000:3000 --env-file .env -v easyfood-uploads:/app/uploads easyfood
#
# O volume em /app/uploads guarda as imagens (pratos e fotos de perfil); sem
# ele, elas se perdem quando o contêiner é recriado (ver docs/deploy.md).

FROM node:22-slim

# O Prisma precisa do OpenSSL para falar com o PostgreSQL.
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências primeiro (cache de camadas). O schema entra antes do `npm ci`
# porque o postinstall roda `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOADS_DIR=/app/uploads

RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# `npm start` aplica as migrations pendentes (prisma migrate deploy) e sobe a API.
CMD ["npm", "start"]
