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
