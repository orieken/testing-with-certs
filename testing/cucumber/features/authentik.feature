Feature: Independent authentik OIDC and SAML brokers
  Scenario Outline: Authentik check: <name>
    Given the authentik check "<name>" passes
    Examples:
      | name |
      | authentik-oidc:login-group |
      | authentik-oidc:no-group |
      | authentik-oidc:wrong-password |
      | authentik-oidc:disabled-user |
      | authentik-oidc:callback-state |
      | authentik-oidc:logout-isolation |
      | authentik-saml:login-group |
      | authentik-saml:no-group |
      | authentik-saml:wrong-password |
      | authentik-saml:disabled-user |
      | authentik-saml:callback-state |
      | authentik-saml:logout-isolation |
      | authentik-saml:invalid-signature |
      | authentik-oidc:broker-state |
      | authentik-oidc:access-expiry-clears-identity |
      | authentik-oidc:refresh-preserves-identity |
      | authentik-oidc:logout-invalidates-refresh |
      | authentik-oidc:refresh-client-binding |
      | authentik-oidc:session-expiry-rejects-refresh |
      | authentik-oidc:group-withdrawal |
      | authentik-saml:access-expiry-clears-identity |
      | authentik-saml:refresh-preserves-identity |
      | authentik-saml:logout-invalidates-refresh |
      | authentik-saml:refresh-client-binding |
      | authentik-saml:session-expiry-rejects-refresh |
      | authentik-saml:group-withdrawal |
