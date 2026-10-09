Feature: View Inventory
    As a shopper
    I want to view the inventory on the demo web app
    So that I can see the available products

    Background:
        Given the demo web app is running

    Scenario: View inventory list on home page
        Given I am on the demo shop home page
        Then I should see a list of products with their names and prices

    Scenario: Inventory shows images and prices for each product
        Given I am on the demo shop home page
        Then each product should display an image and a price


    Scenario: Inventory shows at least 3 items
        Given I am on the demo shop home page
        Then I should see at least 3 products listed

    Scenario: Navigate to item details from the list
        Given I am on the demo shop home page
        When I click on the first product's details link
        Then I should see the product details page with name, price, and description