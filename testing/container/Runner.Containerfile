FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9 AS dependencies
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --global pnpm@12.9.1 --fetch-timeout=30000 --fetch-retries=1
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/magic-shop/package.json apps/magic-shop/package.json
COPY packages/saturday-keycloak/package.json packages/saturday-keycloak/package.json
COPY services/customer-api/package.json services/customer-api/package.json
COPY testing/package.json testing/package.json
COPY contracts/package.json contracts/package.json
COPY spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz
RUN pnpm install --frozen-lockfile --fetch-timeout=30000

FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /work
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 HOME=/home/runner
COPY testing/container/apt.lock testing/container/google.asc testing/container/microsoft.asc testing/container/install-packages.sh testing/container/
RUN sh testing/container/install-packages.sh
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright
COPY testing/container/ testing/container/
COPY --from=dependencies /work/node_modules /work/node_modules
COPY --from=dependencies /work/testing/node_modules /work/testing/node_modules
COPY --from=dependencies /work/packages/saturday-keycloak/node_modules /work/packages/saturday-keycloak/node_modules
RUN /work/testing/node_modules/.bin/playwright install ffmpeg && chmod -R a+rX /opt/ms-playwright
COPY packages/saturday-keycloak/ /work/packages/saturday-keycloak/
RUN cd /work/packages/saturday-keycloak && /work/packages/saturday-keycloak/node_modules/.bin/tsc -p tsconfig.json
COPY testing/ testing/
RUN cd /work/testing && /work/testing/node_modules/.bin/tsc -p tsconfig.runtime.json
COPY contracts/ contracts/
COPY seed/identities.json seed/identities.json
RUN mkdir -p /home/runner /work/testing/test-results /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix && chown -R 1000:1000 /home/runner /work/testing/test-results
USER 1000:1000
ENTRYPOINT ["sh", "/work/testing/container/trust.sh"]
CMD ["node", "/work/testing/container/smoke.mjs"]
