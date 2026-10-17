Feature: Password and TOTP expiry and refresh boundaries
  Each check owns its enrollment and browser contexts. Short client lifetimes belong only to the disposable fixture.

  Scenario Outline: Password and authenticator session check: <check>
    Given the password and authenticator check "<check>" passes

    Examples:
      | check                                                        |
      | access-token expiry clears lesson and requires both factors   |
      | refresh preserves identity and lesson audience                |
      | logout invalidates refresh token                              |
      | refresh token cannot be used by another client                |
      | expired session rejects refresh                               |
