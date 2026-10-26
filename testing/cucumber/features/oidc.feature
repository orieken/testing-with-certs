Feature: Controlled external OpenID Connect federation
  Each check owns a fresh browser context. Credentials stay in the disposable lab.

  Scenario Outline: OIDC check: <check>
    Given the OIDC check "<check>" passes

    Examples:
      | check                                  |
      | oidc:upstream-rp-logout |
      | oidc:upstream-session-revoked |
      | oidc:upstream-token-revoked |
      | oidc:upstream-revocation-broker-boundary |
      | oidc:app-refresh-rotation |
      | oidc:app-refresh-reuse |
      | oidc:upstream-refresh-rotation |
      | oidc:upstream-refresh-reuse |
      | oidc:login-audience-and-logout          |
      | oidc:disabled-provider-user            |
      | oidc:callback-state-rejection          |
      | oidc:cross-protocol-provider-rejection |
      | oidc:broker-state-rejection            |
      | oidc:app-wrong-verifier                |
      | oidc:app-missing-verifier              |
      | oidc:app-replay                        |
      | oidc:app-redirect                      |
      | oidc:upstream-wrong-verifier           |
      | oidc:upstream-missing-verifier         |
      | oidc:upstream-replay                   |
      | oidc:upstream-redirect                 |
      | oidc:authorization-cancelled |
      | oidc:callback-interrupted |
      | oidc:provider-unavailable |
      | oidc:token-unavailable |
      | oidc:token-interrupted |
      | oidc:logout-unavailable |
      | oidc:upstream-id-token-signed-control |
      | oidc:upstream-id-token-signature |
      | oidc:upstream-id-token-unknown-key |
      | oidc:upstream-id-token-issuer |
      | oidc:upstream-id-token-audience |
      | oidc:upstream-id-token-authorized-party |
      | oidc:upstream-id-token-expired |
      | oidc:upstream-id-token-not-yet-valid |
      | oidc:upstream-id-token-nonce |
      | oidc:upstream-id-token-missing-nonce |
      | oidc:signing-key-native-rotation |
      | oidc:jwks-cached-key-outage |
      | oidc:jwks-uncached-key-outage |
      | oidc:jwks-malformed-response |
      | oidc:jwks-empty-response |
