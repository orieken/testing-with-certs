FROM registry.access.redhat.com/ubi9/ubi:9.6@sha256:dec374e05cc13ebbc0975c9f521f3db6942d27f8ccdf06b180160490eef8bdbc
COPY infra/postgres/secrets.sh /work/secrets.sh
ENTRYPOINT ["bash", "/work/secrets.sh"]
