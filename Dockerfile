# One app instance and one database are enough for a small release.
# Pin the package manager and install exactly the committed lockfile.
FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/content/package.json packages/content/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile --filter @aral/web... --filter @aral/api...
COPY . .
RUN pnpm --filter @aral/content build && pnpm --filter @aral/ui build

FROM build AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "--import", "tsx", "src/index.ts"]

# Migrations run explicitly before starting the API, with the same source version.
FROM build AS migrate
WORKDIR /app/packages/db
USER node
CMD ["node", "node_modules/drizzle-kit/bin.cjs", "migrate"]

FROM build AS web-build
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @aral/web build

FROM web-build AS web
ENV NODE_ENV=production
WORKDIR /app/apps/web
RUN chown -R node:node .next
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3000"]
