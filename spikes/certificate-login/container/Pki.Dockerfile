FROM registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc AS source
WORKDIR /work
COPY pki/issue.sh /work/issue.sh
FROM registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc
WORKDIR /work
RUN mkdir /state /public /gateway /keycloak /landing /fixtures /manual-customer /manual-admin && chown 1000:1000 /state /public /gateway /keycloak /landing /fixtures /manual-customer /manual-admin
COPY --from=source --chown=1000:1000 /work/issue.sh /work/issue.sh
USER 1000:1000
ENTRYPOINT ["bash", "/work/issue.sh"]
