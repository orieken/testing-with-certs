Feature: Isolated Kerberos tickets with no password fallback
  Each check owns a fresh persistent browser profile. Tickets remain in the disposable lab.

  Scenario Outline: Kerberos ticket check: <check>
    Given the Kerberos check "<check>" passes

    Examples:
      | check                         |
      | kerberos:valid-ticket         |
      | kerberos:missing-ticket       |
      | kerberos:expired-ticket       |
      | kerberos:wrong-service-ticket |

  @disabled
  Scenario: Disabled Kerberos account
    Given the Kerberos check "kerberos:disabled-user" passes
