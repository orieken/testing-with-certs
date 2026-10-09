FROM registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc
RUN mkdir -p /out/admin /out/catalog /out/reporting && chown -R 1000:1000 /out
COPY --chown=1000:1000 infra/keycloak/auth-secrets.sh /work/auth-secrets.sh
USER 1000:1000
ENTRYPOINT ["bash", "/work/auth-secrets.sh"]
