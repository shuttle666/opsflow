FROM node:22-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

FROM base AS builder

ARG DATABASE_URL=postgresql://opsflow:opsflow@localhost:5432/opsflow
ENV DATABASE_URL=$DATABASE_URL

COPY package.json pnpm-lock.yaml tsconfig.json prisma.config.ts ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

COPY src ./src

RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-bookworm-slim AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid 1001 opsflow

COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/tsconfig.json /app/prisma.config.ts ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN mkdir -p /app/uploads/evidence \
  && chown -R opsflow:nodejs /app

USER opsflow

EXPOSE 4000

CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
