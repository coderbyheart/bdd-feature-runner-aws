Feature: A feature with random strings

    This shows how to generate random strings

    Scenario: Generate a custom string (generators can be customized)

        Given I have a random foo in "foo"
        Then "foo" should equal "foo"
