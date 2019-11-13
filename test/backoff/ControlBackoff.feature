Feature: The retry can be controlled with tags

    @Retry=failAfter:3,maxDelay:100,initialDelay:50
    Scenario: Retry this scenario with a custom configuration

        Given this will fail