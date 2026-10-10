FROM node:24.10.0-bookworm-slim@sha256:b8d2197aff9129d16c801a3e3e1b2a873c4946480f5a310f38056df2268c38d9
WORKDIR /app
RUN mkdir -p /matrix-key /test-secrets && chown 1000:1000 /matrix-key /test-secrets
COPY --chown=1000:1000 infra/keycloak/bootstrap.mjs /app/bootstrap.mjs
COPY --chown=1000:1000 infra/keycloak/operator.mjs /app/operator.mjs
COPY --chown=1000:1000 infra/keycloak/password-input.mjs /app/password-input.mjs
COPY --chown=1000:1000 infra/keycloak/teaching-fixture.mjs /app/teaching-fixture.mjs
COPY --chown=1000:1000 infra/keycloak/scope-negative.mjs /app/scope-negative.mjs
COPY --chown=1000:1000 infra/keycloak/rotate-key.mjs /app/rotate-key.mjs
COPY --chown=1000:1000 infra/keycloak/jwt-matrix-key.mjs /app/jwt-matrix-key.mjs
COPY --chown=1000:1000 infra/keycloak/realm.json /app/realm.json
COPY --chown=1000:1000 seed/identities.json /app/identities.json
ENV NODE_EXTRA_CA_CERTS=/trust/server-ca.pem
USER 1000:1000
ENTRYPOINT ["node", "/app/bootstrap.mjs"]
