Feature: Formatter edge cases
  Scenario: Failed
    Given a deliberate failure
  Scenario: Pending
    Given a pending implementation
  Scenario: Undefined
    Given a step without an implementation
  Scenario: Ambiguous
    Given an ambiguous implementation
  @hook-failure
  Scenario: Hook failure
    Given the answer is 42
  @retry
  Scenario: Flaky
    Given a retry succeeds
  Scenario: Skipped
    Given a skipped implementation
  Scenario: hostile <img src=x onerror="window.pwned=1"> title
    Given the answer is 42
