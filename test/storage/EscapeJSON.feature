Feature: Escaping JSON

  Scenario: Escape a JSON string

    When I escape this JSON into "escapedJSON"
       """
       {"baz":"foo","num":42,"b":true}
       """
