FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

RUN pnpm approve-builds --all && pnpm install --frozen-lockfile

RUN pnpm --filter @openscript/screenplay-schema run build && \
    pnpm --filter @openscript/database run build && \
    pnpm --filter @openscript/fountain run build && \
    pnpm --filter api run build

FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app /app

EXPOSE 3000

CMD ["node", "apps/api/dist/index.js"]
