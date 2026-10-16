FROM quay.io/keycloak/keycloak:26.4.0@sha256:5f3fb534cde6bf006d79f5912473e5d2c828c707cdfc52e16972803aca9d43dd AS keycloak
FROM eclipse-temurin:21-jdk-jammy@sha256:e0c60c487345d1dc9d0fc7b6f0496f3cc941e5132e09296cc17a6decc71b902b AS compiler
COPY --from=keycloak /opt/keycloak/lib/lib/main /keycloak-libs
COPY infra/auth-lessons/recipient-mapper /source
RUN mkdir /classes && javac --release 21 -cp '/keycloak-libs/*' -d /classes /source/SamlRecipientMapper.java \
    && cp -r /source/META-INF /classes/ && jar --create --file /recipient-mapper.jar -C /classes .
FROM keycloak
COPY --from=compiler --chown=1000:0 /recipient-mapper.jar /opt/keycloak/providers/recipient-mapper.jar
