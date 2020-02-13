# BDD Feature Runner for AWS

[![GitHub Package Registry version](https://img.shields.io/github/release/coderbyheart/bdd-feature-runner-aws.svg?label=GPR&logo=github)](https://github.com/coderbyheart/bdd-feature-runner-aws/packages/26679)
[![GitHub Actions](https://github.com/coderbyheart/bdd-feature-runner-aws/workflows/Test%20and%20Release/badge.svg)](https://github.com/coderbyheart/bdd-feature-runner-aws/actions)
[![Greenkeeper badge](https://badges.greenkeeper.io/coderbyheart/bdd-feature-runner-aws.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier/)
[![ESLint: TypeScript](https://img.shields.io/badge/ESLint-TypeScript-blue.svg)](https://github.com/typescript-eslint/typescript-eslint)

An implementation of a [Gherkin](https://docs.cucumber.io/gherkin/) feature
runner for cloud native applications made with AWS.

Example usage:
[bdd-feature-runner-aws-example](https://github.com/coderbyheart/bdd-feature-runner-aws-example).

## Motivation

[Video](https://youtu.be/yt7oJ-To4kI) ·
[Slides](https://coderbyheart.com/it-does-not-run-on-my-machine/)

[![Video](./video.jpg)](https://youtu.be/yt7oJ-To4kI)

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
