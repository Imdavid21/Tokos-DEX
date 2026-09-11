FROM node:24.21.0-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=development
COPY . .
RUN pnpm install --frozen-lockfile
RUN TSC="$(find /app/node_modules/.pnpm -type f \( -path '*/node_modules/@typescript/typescript6/bin/tsc' -o -path '*/node_modules/@typescript/typescript6/lib/tsc.js' \) | head -n1)" \
 && test -n "$TSC" \
 && printf '#!/bin/sh\nexec node "%s" "$@"\n' "$TSC" > /usr/local/bin/tsc \
 && chmod +x /usr/local/bin/tsc
ENV NODE_ENV=production
ENV NEXT_PUBLIC_BASE_PATH=/data
RUN pnpm build

FROM node:24.21.0-bookworm-slim AS runtime
RUN corepack enable && corepack prepare pnpm@12.3.4 --activate
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
CMD ["sh", "-c", "pnpm --filter @tokos-data/${SERVICE:-api} start"]
