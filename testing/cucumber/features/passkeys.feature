Feature: Certificate-free passkey lessons with virtual authenticators
  Each scenario owns its enrollment, account, credentials, and browser contexts.

  Scenario Outline: Passkey check: <check>
    Given the passkey check "<check>" passes

    Examples:
      | check                       |
      | passkeys:enrollment          |
      | passkeys:login-and-logout    |
      | passkeys:missing-credential  |
      | passkeys:invalid-signature   |
      | passkeys:disabled-user       |
      | passkeys:unconfigured-user   |
      | passkeys:account-isolation   |
