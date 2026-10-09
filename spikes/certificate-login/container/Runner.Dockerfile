FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 AS dependencies
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY vendor/ vendor/
RUN npm ci --ignore-scripts --fetch-timeout=30000 --fetch-retries=1
FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY container/ container/
RUN sh container/install-packages.sh
COPY --from=dependencies /work/node_modules /work/node_modules
COPY . .
RUN chown 1000:1000 /work
USER 1000:1000
ENTRYPOINT ["sh", "/work/container/trust.sh"]
CMD ["npm", "test"]
