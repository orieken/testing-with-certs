Feature: Certificate-free password and authenticator-code lessons
  Each check owns its enrollment and browser contexts. Credentials stay in the disposable lab.

  Scenario Outline: Password and authenticator check: <check>
    Given the password and authenticator check "<check>" passes

    Examples:
      | check                                                     |
      | certificate-free entrance and route boundaries            |
      | enrollment and lesson audience denied at business APIs     |
      | wrong password                                            |
      | incorrect and expired codes                               |
      | disabled user                                             |
      | successful login, logout and cookie cannot skip factors    |
      | fresh profile and second account isolation                 |
