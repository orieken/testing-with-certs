Feature: Controlled SAML federation and signed assertion boundaries
  Each check owns a fresh browser context. Assertions and signing material stay in the disposable lab.

  Scenario Outline: SAML check: <check>
    Given the SAML check "<check>" passes

    Examples:
      | check                                  |
      | saml:login-audience-and-logout          |
      | saml:disabled-provider-user            |
      | saml:callback-state-rejection          |
      | saml:cross-protocol-provider-rejection |
      | saml:broker-state-rejection            |
      | saml:modified-signed-response          |
      | saml:response-replay                   |
      | saml:signed-control                    |
      | saml:signed-wrong-audience             |
      | saml:signed-wrong-recipient            |
      | saml:signed-expired                    |
