FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@12.14.0 --activate

# Copy workspace definitions
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Approve build scripts & install dependencies
RUN pnpm approve-builds --all && pnpm install --frozen-lockfile

# Build web package
RUN pnpm --filter @openscript/screenplay-schema run build && \
    pnpm --filter @openscript/editor run build && \
    pnpm --filter @openscript/fountain run build && \
    pnpm --filter web run build

FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
