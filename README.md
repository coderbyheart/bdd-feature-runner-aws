# BDD Feature Runner for AWS

[![npm version](https://img.shields.io/npm/v/@coderbyheart/bdd-feature-runner-aws.svg)](https://www.npmjs.com/package/@coderbyheart/bdd-feature-runner-aws)
[![GitHub Actions](https://github.com/coderbyheart/bdd-feature-runner-aws/workflows/Test%20and%20Release/badge.svg)](https://github.com/coderbyheart/bdd-feature-runner-aws/actions)
[![Greenkeeper badge](https://badges.greenkeeper.io/coderbyheart/bdd-feature-runner-aws.svg)](https://greenkeeper.io/)

An implementation of a [Gherkin](https://docs.cucumber.io/gherkin/) feature
runner for cloud native applications made with AWS.

Example usage:
[bdd-feature-runner-aws-example](https://github.com/coderbyheart/bdd-feature-runner-aws-example).

## Special annotations

- `@Skip`: Do not run this feature
- `@Only`: Run only this feature
- `@Last`: Run this feature after all others
