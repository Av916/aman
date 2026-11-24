FROM oven/bun:1.4.0 AS bun
FROM node:24-bookworm-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
COPY . .
ENV CONTAINER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
# Build placeholders are stage-local and have no external privileges.
RUN APP_URL=http://localhost:3000 DATABASE_URL=postgresql://build:build@127.0.0.1:1/build AUTH_SECRET=build-only-placeholder-string-no-privileges bun run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD ["node","-e","fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "server.js"]
