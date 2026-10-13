Feature: Real regional report boundaries
 Scenario Outline: Live map and tables agree with the provider
  Given I verify live regional scenario "<scenario>"
  Examples:
   | scenario |
   | november-pages |
   | moved-profile |
   | empty-region |
   | september-oracle |
