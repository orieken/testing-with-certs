Feature: Isolated browser consumers with mock dependencies
  Scenario Outline: Browser behavior with synthetic authentication
    Given I exercise isolated mock scenario "<scenario>"
    Examples:
      | scenario |
      | customer |
      | admin |
      | auth-denied |
      | wrong-state |
      | invalid-claims |
      | refresh-failure |
      | checkout-403 |
      | checkout-503 |
      | checkout-delay |
      | checkout-malformed |
      | oidc-success |
      | oidc-discovery-failure |
      | oidc-token-failure |
      | oidc-signature-failure |
