Feature: Kerberos lesson token and session boundaries
  Each scenario owns a browser profile, copied ticket cache, and token material.

  Scenario Outline: Kerberos lifecycle check: <check>
    Given the Kerberos check "<check>" passes

    Examples:
      | check                                     |
      | kerberos:access-expiry-reenters-login      |
      | kerberos:refresh-without-ticket-cache     |
      | kerberos:logout-invalidates-refresh       |
      | kerberos:refresh-client-binding           |
      | kerberos:session-expiry-rejects-refresh    |
