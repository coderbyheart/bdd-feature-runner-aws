Feature: A feature with random strings

    This shows how to generate random strings

    Scenario: Generate a random UUID (this is a built-in feature)

        Given I have a random UUID in "uuidStorageKey"
        Then "$length(uuidStorageKey)" should equal 36

