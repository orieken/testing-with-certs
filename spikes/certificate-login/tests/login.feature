@prompt01 @AUTH-01
Feature: Certificate-backed identity
  Scenario: A selected customer signs in through Keycloak without a password
    Given a selected customer certificate
    When the customer signs in to the landing app
    Then Keycloak identifies the customer without a password
