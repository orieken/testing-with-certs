# Spike terms

- **Certificate identity**: opaque user attribute and certificate subject CN, immutable to ordinary users.
- **User**: synthetic Keycloak customer or shop-admin; role is assigned by Keycloak, not encoded in the certificate.
- **Gateway**: HAProxy shop TLS terminator; the sole allowed caller of the landing endpoint.
- **Landing**: bounded spike UI and identity endpoint; not one of the three planned business APIs.
- **Native mode**: browser uses its NSS certificate database and loaded policy without Playwright context certificates.
- **Context mode**: Playwright supplies certificates for two exact origins through its upstream-verifying proxy.
