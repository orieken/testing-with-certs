Feature: Controlled external OpenID Connect federation
  Each check owns a fresh browser context. Credentials stay in the disposable lab.

  Scenario Outline: OIDC check: <check>
    Given the OIDC check "<check>" passes

    Examples:
      | check                                  |
      | oidc:login-audience-and-logout          |
      | oidc:disabled-provider-user            |
      | oidc:callback-state-rejection          |
      | oidc:cross-protocol-provider-rejection |
      | oidc:broker-state-rejection            |
