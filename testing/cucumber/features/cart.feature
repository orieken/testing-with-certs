Feature: Shopping cart operations
  As a shopper
  I want to manage items in my cart
  So that I can purchase exactly what I need

  Background:
    Given the demo web app is running
    Given I am on the demo shop home page

  @cart @same_item_twice
  Scenario: Add the same item twice increases quantity to 2
    When I add the first product to the cart
    And I add the first product to the cart
    And I go to the cart page
    Then I should see quantity 2 for the first cart item
    And the subtotal for the first cart item should be the unit price times 2
    And the cart total should equal the subtotal of all items

  @cart @quantities
  Scenario: Increase quantity from the cart page
    When I add the first product to the cart
    And I go to the cart page
    And I increase the quantity of the first cart item to 2
    Then I should see quantity 2 for the first cart item
    And the subtotal for the first cart item should be the unit price times 2
    And the cart total should reflect the updated subtotal

  @cart @remove
  Scenario: Remove an item from the cart
    When I add the first product to the cart
    And I go to the cart page
    And I remove the first cart item
    Then the cart should be empty

  @cart @mixed @focus
  Scenario: Add two different items and remove one
    When I add the first product to the cart
    And I add the second product to the cart
    And I go to the cart page
    Then I should see 2 items in the cart
    When I remove the second cart item
    Then I should see 1 item in the cart
    And the cart total should equal the remaining item subtotal

