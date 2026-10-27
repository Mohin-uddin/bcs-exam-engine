FROM node:20-alpine AS runner

WORKDIR /app

COPY package*.json ./
COPY src ./src
COPY prisma ./prisma

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/web/server.js"]
