FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 AS dependencies
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY vendor/ vendor/
RUN npm ci --ignore-scripts --fetch-timeout=30000 --fetch-retries=1
COPY src/ src/
RUN ./node_modules/.bin/esbuild src/app.ts --bundle --platform=browser --format=esm --outfile=public/app.js
FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /work
COPY --from=dependencies /work/node_modules /work/node_modules
COPY --from=dependencies /work/public /work/public
COPY package.json tsconfig.json ./
COPY src/ src/
USER 1000:1000
CMD ["node", "--import", "tsx", "src/adapters/server.ts"]
