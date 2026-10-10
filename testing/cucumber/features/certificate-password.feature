Feature: Both a client certificate and its account password are required
  Scenario Outline: Keycloak verifies both factors and preserves the shop
    Given the certificate and password check "<check>" passes
    Examples:
      | check          |
      | success        |
      | wrong-password |
      | missing        |
      | wrong          |
      | disabled       |
      | unknown        |
      | unconfigured   |
      | cookies        |
      | shop           |
