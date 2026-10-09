FROM magic-shop-saturday-keycloak:05 AS packed
RUN cd /work/packages/saturday-keycloak && pnpm pack --pack-destination /tmp

FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /consumer
COPY --from=packed /tmp/saturday-keycloak-prototype-0.1.0.tgz /tmp/local-package.tgz
COPY spikes/certificate-login/vendor/orieken-saturday-playwright-certs-0.1.0.tgz /tmp/certificate-helper.tgz
RUN npm install --ignore-scripts --no-audit --no-fund --fetch-timeout=30000 --fetch-retries=1 --save-exact \
    /tmp/local-package.tgz /tmp/certificate-helper.tgz \
    @playwright/test@1.61.0 @cucumber/cucumber@12.9.0 @orieken/saturday-cucumber@0.1.1
COPY packages/saturday-keycloak/examples/consumer.mjs ./consumer.mjs
RUN node consumer.mjs
