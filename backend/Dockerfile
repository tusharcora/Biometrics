FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
# Carries both schema.prisma and migrations/, which `prisma migrate deploy`
# needs at startup. The prisma CLI itself is available in the production tree
# because @prisma/client depends on it. prisma.config.ts is deliberately NOT
# copied: Prisma's defaults already resolve prisma/schema.prisma and
# prisma/migrations, and the config file imports dotenv, which this package
# does not declare as a dependency.
COPY prisma ./prisma

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=3s CMD node -e "require('http').get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Migrate before serving: without this a fresh container starts against a
# schema-less database and every query fails.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
