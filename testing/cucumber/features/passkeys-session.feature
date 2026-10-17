Feature: Passkey session and refresh boundaries with virtual authenticators
  Each scenario owns its enrollment, account, credentials, tokens, and browser contexts.

  Scenario Outline: Passkey lifecycle check: <check>
    Given the passkey check "<check>" passes

    Examples:
      | check                                   |
      | passkeys:access-expiry-requires-passkey  |
      | passkeys:refresh-preserves-identity      |
      | passkeys:logout-invalidates-refresh      |
      | passkeys:refresh-client-binding         |
      | passkeys:session-expiry-rejects-refresh  |
