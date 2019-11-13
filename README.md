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

### On Features

- `@Skip`: Do not run this feature
- `@Only`: Run only this feature
- `@Last`: Run this feature after all others

### On Scenarios

- `@Retry`: configures the retry behaviour. Pass one or multiple settings to
  override the default behaviour. Example:
  `@Retry=failAfter:3,maxDelay:100,initialDelay:50`.

## Note on TypeScript 3.7 Beta

This project makes use of TypeScript 3.7 features, therefore typescript-eslint
is currently disabled
[until it supports them](https://github.com/typescript-eslint/typescript-eslint/issues/1033).

Also once
[this fix has been published](https://github.com/microsoft/TypeScript/issues/33744)
replace `(example?.tableBody ?? []).filter` with `example?.tableBody?.filter`.
