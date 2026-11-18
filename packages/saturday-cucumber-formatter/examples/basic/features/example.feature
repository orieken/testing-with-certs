Feature: Ordinary Cucumber scenarios
  Scenario Outline: An example row
    Given the answer is <answer>
    Then a screenshot is attached

    Examples:
      | answer |
      | 42     |
      | 43     |

  @saturday:recording=disabled
  Scenario: No recording required
    Given the answer is 42

  @video
  Scenario: A page can be recorded
    Given a page is displayed
