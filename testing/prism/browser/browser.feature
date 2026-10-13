Feature: Contract-derived Prism UI consumers with synthetic authentication
  Scenario Outline: Existing Vue error and recovery behavior
    Given I exercise Prism consumer scenario "<scenario>"
    Examples:
      | scenario |
      | catalog-populated |
      | catalog-empty |
      | catalog-wrong-type |
      | checkout-409 |
      | checkout-422 |
      | checkout-503 |
      | checkout-403 |
      | checkout-malformed-json |
      | checkout-oversized |
      | checkout-delay |
      | checkout-disconnect |
