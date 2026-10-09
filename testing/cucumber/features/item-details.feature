Feature: Item details
    As a shopper
    I want to view item details on the demo web app
    So that I can see more information about a product

    Background:
        Given the demo web app is running

    Scenario: View item details from home page
        Given I am on the demo shop home page
        When I click on the first product's details link
        Then I should see the product details page with name, price, and description