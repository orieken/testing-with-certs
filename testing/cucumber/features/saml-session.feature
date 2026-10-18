Feature: Controlled SAML broker session, refresh, and role boundaries
  Each scenario owns its provider/broker account, browser context, assertion, and tokens.

  Scenario Outline: SAML lifecycle check: <check>
    Given the SAML check "<check>" passes

    Examples:
      | check                                  |
      | saml:access-expiry-reenters-federation  |
      | saml:refresh-preserves-role             |
      | saml:refresh-without-role               |
      | saml:logout-invalidates-refresh         |
      | saml:refresh-client-binding             |
      | saml:session-expiry-rejects-refresh      |
