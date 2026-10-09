Feature: Certificate-backed Magic Shop teaching journeys
  Each example uses the selected real Chrome or Edge browser and its own certificate context.

  @login
  Scenario: Selected certificate opens the live shop and account
    Given I sign in to the live shop with my selected certificate
    Then my selected identity and live catalog are visible
    When I open my account
    Then my seeded display name is visible

  @customer @order
  Scenario: Customer places a simulated order and finds it in their account
    Given I sign in to the live shop with my selected certificate
    When I add the Wand of Embers and place an order in waterdeep
    Then the created order appears in my account

  @login
  Scenario: Logout ends the session and the installed certificate signs in again
    Given I sign in to the live shop with my selected certificate
    When I sign out and revisit the shop
    Then my selected certificate signs in again without a password

  @customer @widget
  Scenario: Customer widget setting persists and admin report is forbidden
    Given I sign in to the live shop with my selected certificate
    When I change and save my recent-orders widget
    Then the widget setting persists after a fresh certificate sign-in
    And the admin report rejects my customer token

  @admin @region
  Scenario: Administrator sees the September Waterdeep report and local map
    Given I sign in to the live shop with my selected certificate
    When I select the September Waterdeep report
    Then the report shows 570 gp across three orders and two customers
    And the regional map needs no external host
