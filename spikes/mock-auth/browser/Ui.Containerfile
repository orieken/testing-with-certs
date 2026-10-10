FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 AS build
WORKDIR /work
ENV CI=true
RUN npm install --global --ignore-scripts --no-audit --no-fund pnpm@12.9.1 --fetch-timeout=30000
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/magic-shop/package.json apps/magic-shop/package.json
COPY contracts/package.json contracts/package.json
RUN pnpm install --frozen-lockfile --filter @magic-shop/ui --filter @magic-shop/contracts --fetch-timeout=30000
COPY apps/magic-shop apps/magic-shop
COPY contracts/generated contracts/generated
RUN apps/magic-shop/node_modules/.bin/vue-tsc --noEmit -p apps/magic-shop/tsconfig.json \
    && cd apps/magic-shop && node_modules/.bin/vite build
FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /example
COPY --from=build /work/apps/magic-shop/dist /example/dist
COPY spikes/mock-auth/browser/server.mjs spikes/mock-auth/browser/oidc-consumer.html ./
USER 1000:1000
CMD ["node", "/example/server.mjs"]
