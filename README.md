# BDD Feature Runner for AWS

[![GitHub Package Registry version](https://img.shields.io/github/release/coderbyheart/bdd-feature-runner-aws.svg?label=GPR&logo=github)](https://github.com/coderbyheart/bdd-feature-runner-aws/packages/26679)
[![GitHub Actions](https://github.com/coderbyheart/bdd-feature-runner-aws/workflows/Test%20and%20Release/badge.svg)](https://github.com/coderbyheart/bdd-feature-runner-aws/actions)
[![Greenkeeper badge](https://badges.greenkeeper.io/coderbyheart/bdd-feature-runner-aws.svg)](https://greenkeeper.io/)

An implementation of a [Gherkin](https://docs.cucumber.io/gherkin/) feature
runner for cloud native applications made with AWS.

Example usage:
[bdd-feature-runner-aws-example](https://github.com/coderbyheart/bdd-feature-runner-aws-example).

## Installation

> Note: This package is hosted on the GitHub package registry and 
> [npm needs to be configured](https://help.github.com/en/articles/configuring-npm-for-use-with-github-package-registry#installing-a-package)
> in order to use it.

    echo "@coderbyheart:registry=https://npm.pkg.github.com" >> .npmrc
    npm i --save-dev @coderbyheart/bdd-feature-runner-aws

## Special annotations

- `@Skip`: Do not run this feature
- `@Only`: Run only this feature
- `@Last`: Run this feature after all others
