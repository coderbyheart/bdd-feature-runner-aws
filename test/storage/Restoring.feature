Feature: Restoring stored data

  Scenario: Select a member of a stored value and store it under a different name

    When I store "bar.baz" into "myBaz"
    Then "myBaz" should equal "foo"
