Feature: Controlled external OIDC broker session and refresh boundaries
  Each scenario owns its provider/broker account, browser context, and tokens.

  Scenario Outline: OIDC lifecycle check: <check>
    Given the OIDC check "<check>" passes

    Examples:
      | check                                  |
      | oidc:access-expiry-reenters-federation  |
      | oidc:refresh-preserves-identity         |
      | oidc:logout-invalidates-refresh        |
      | oidc:refresh-client-binding            |
      | oidc:session-expiry-rejects-refresh     |
