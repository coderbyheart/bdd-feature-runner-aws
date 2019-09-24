Feature: Simple storage

  Scenario: Match a stored value against a string

    Then "foo" should equal "bar"

  Scenario: Match a stored value against a JSON object

    Then "bar" should match this JSON
      """
      {"baz":"foo"}
      """

  Scenario: Deep equal a stored value against a JSON object

    Then "bar" should equal this JSON
      """
      {"baz":"foo","num":42,"b":true}
      """

  Scenario: Match a member of a stored value against a string

    Then "bar.baz" should equal "foo"
    Then "bar.baz" should equal this JSON
      """
      "foo"
      """

  Scenario: Match a member of a stored value against a number

    Then "bar.num" should equal this JSON
      """
      42
      """
    Then "bar.num" should equal 42

  Scenario: Match a member of a stored value against a boolean

    Then "bar.b" should equal this JSON
      """
      true
      """
    Then "bar.b" should be true

  Scenario: Use a JSON expression to transform a stored value

    Then "$length(bar.baz)" should equal 3
