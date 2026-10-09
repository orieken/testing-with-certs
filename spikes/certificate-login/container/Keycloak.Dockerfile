FROM quay.io/keycloak/keycloak:26.4.0@sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd AS builder
WORKDIR /opt/keycloak
RUN /opt/keycloak/bin/kc.sh build --db=dev-file --health-enabled=true --https-client-auth=request
FROM quay.io/keycloak/keycloak:26.4.0@sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd
WORKDIR /opt/keycloak
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY --chown=1000:0 keycloak/realm.json /opt/keycloak/data/import/realm.json
USER 1000
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
