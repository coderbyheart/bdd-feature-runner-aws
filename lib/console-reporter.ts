import {
  FeatureResult,
  Reporter,
  RunResult,
  ScenarioResult,
  StepResult,
  StepRunnerNotDefinedError,
} from './runner';

const chalk = require('chalk');
import * as Chai from 'chai';

type Config = { printResults: boolean; printProgress: boolean };

export class ConsoleReporter implements Reporter {
  private config: Config;
  private lastProgress?: number;

  constructor(config: Config = { printResults: false, printProgress: false }) {
    this.config = config;
  }

  async report(result: RunResult) {
    result.featureResults.forEach(featureResult => {
      reportFeature(featureResult);
      featureResult.scenarioResults.forEach(scenarioResult => {
        reportScenario(scenarioResult);
        scenarioResult.stepResults.forEach(stepResult => {
          reportStep(stepResult, this.config);
        });
      });
    });
    reportRunResult(result.success, result.runTime);
    if (result.error) {
      console.error(
        ' ',
        chalk.red.bold(' 🚨 '),
        chalk.yellow(result.error.message),
      );
    }
  }

  async progress(type: string, info?: string) {
    if (!this.config.printProgress) return;
    const i = [' ', chalk.magenta(' ℹ '), chalk.cyan(type)];
    if (info) {
      i.push(chalk.grey(info));
    }
    if (this.lastProgress)
      i.push(chalk.blue(`⏱ +${Date.now() - this.lastProgress}ms`));
    this.lastProgress = Date.now();
    console.log(...i);
  }
}

const reportFeature = (result: FeatureResult) => {
  console.log('');
  console.log('', chalk.yellow.bold(result.feature.name));
  console.log('');
  const i = [' '];

  if (result.feature.skip) {
    i.push(chalk.magenta(' ↷ '), chalk.magenta('(skipped)'));
  } else {
    i.push(result.success ? chalk.green(' 💯') : chalk.red.bold(' ❌'));
    if (result.runTime) {
      i.push(chalk.blue(`⏱ ${result.runTime}ms`));
    }
  }
  if (result.feature.tags.length) {
    i.push(chalk.magenta(result.feature.tags.map(({ name }) => name)));
  }
  console.log(...i);
};

const reportScenario = (result: ScenarioResult) => {
  console.log('');
  const i = [chalk.gray(result.scenario.type)];
  if (result.skipped) {
    i.push(chalk.magenta(' ↷ '), chalk.magenta('(skipped)'));
    if (result.scenario.name) i.push(chalk.gray(result.scenario.name));
  } else {
    if (result.scenario.name) i.push(chalk.yellow(result.scenario.name));
    if (result.runTime) i.push(chalk.blue(`⏱ ${result.runTime}ms`));
    if (result.tries > 1) i.push(chalk.red(`⏱ ${result.tries}x`));
  }
  console.log('', ...i);
  console.log('');
};

const reportRunResult = (success: boolean, runTime?: Number) => {
  console.log('');
  const i = [
    success ? chalk.green(' 💯 ALL PASS ') : chalk.red.bold(' 💀 FAIL 👎 '),
  ];
  if (runTime) i.push(chalk.blue(`⏱ ${runTime}ms`));
  if (success) i.push('');
  console.log(' ', ...i);
  console.log('');
};

const reportStep = (result: StepResult, config: Config) => {
  const i = [' '];
  if (result.skipped) {
    i.push(chalk.gray(' ↷ '));
    i.push(chalk.gray(result.step.interpolatedText));
    i.push(chalk.magenta('(skipped)'));
  } else {
    if (result.success) {
      i.push(chalk.green(' ✔ '));
      i.push(chalk.yellow(result.step.interpolatedText));
      if (result.runTime) i.push(chalk.blue(`⏱ ${result.runTime}ms`));
    } else {
      i.push(chalk.red.bold(' ❌ '));
      i.push(chalk.red.bold(result.step.interpolatedText));
    }
  }
  console.log(...i);
  if (result.result && config.printResults) {
    [
      ...(Array.isArray(result.result) ? result.result : [result.result]),
    ].forEach(r => {
      console.log(chalk.cyan('   ▶'), chalk.cyan(JSON.stringify(r)));
    });
  }
  if (result.error) {
    if (
      result.error instanceof StepRunnerNotDefinedError &&
      result.error.step.interpolatedText !== result.error.step.text
    ) {
      console.log(
        chalk.grey('   ▶'),
        chalk.grey(result.error.step.interpolatedText),
      );
    }
    console.error(
      ' ',
      chalk.red.bold(' 🚨 '),
      chalk.yellow.bold('👆'),
      chalk.yellow(result.error.message),
    );
    if (result.error instanceof Chai.AssertionError) {
      console.log(
        chalk.green('   Expected:'),
        JSON.stringify((result.error as any).expected),
      );
      console.log(
        chalk.red.bold('   Actual:  '),
        JSON.stringify((result.error as any).actual),
      );
    }
  }
};
