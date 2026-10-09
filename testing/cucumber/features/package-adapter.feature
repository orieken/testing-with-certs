Feature: Selected certificate through the Saturday Keycloak adapter
  Scenario: Certificate login through the real browser
    Given I open the certificate shop
    When I sign in with my selected certificate
    Then the selected identity is shown
