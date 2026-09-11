FROM node:24.21.0-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=development
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:24.21.0-bookworm-slim AS runtime
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["sh", "-c", "pnpm --filter @tokos-data/${SERVICE:-api} start"]
