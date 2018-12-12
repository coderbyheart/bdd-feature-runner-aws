import {
  fromDirectory,
  Scenario,
  SkippableFeature,
  Step,
} from './load-features';
import { ConsoleReporter } from './console-reporter';
import { exponential } from 'backoff';

const allSuccess = (r: boolean, result: Result) => (result.success ? r : false);

export const afterRx = /^I am run after the "([^"]+)" feature$/;

export type Cleaner = <W extends Store>(
  runner: FeatureRunner<W>,
) => Promise<any>;

export class FeatureRunner<W> {
  private readonly featuresDir: string;
  private readonly reporters: Reporter[];
  private readonly stepRunners: StepRunner<W>[] = [];
  private readonly cleaners: Cleaner[] = [];
  public store: Store;
  public world: Store;

  constructor(
    world: W,
    options: { dir: string; reporters?: Reporter[]; store?: Store },
  ) {
    this.world = world;
    this.featuresDir = options.dir;
    this.reporters = options.reporters || [new ConsoleReporter()];
    this.store = options.store || {};
  }

  addStepRunners(runners: StepRunner<W>[]): FeatureRunner<W> {
    this.stepRunners.push(...runners);
    return this;
  }

  cleanup(fn: Cleaner) {
    this.cleaners.push(fn);
  }

  async progress(type: string, info?: string) {
    await Promise.all(
      this.reporters.map(reporter => reporter.progress(type, info)),
    );
  }

  async run(): Promise<RunResult> {
    const features = await fromDirectory(this.featuresDir);
    const startRun = Date.now();
    const featureResults: FeatureResult[] = [];
    await features.reduce(
      (promise, feature) =>
        promise.then(async () => {
          featureResults.push(await this.runFeature(feature));
        }),
      Promise.resolve(),
    );
    const result = {
      success: featureResults.reduce(allSuccess, true),
      runTime: Date.now() - startRun,
      featureResults,
    };
    await Promise.all(this.reporters.map(reporter => reporter.report(result)));
    await this.cleaners.reduce(
      (promise, cleaner) =>
        promise.then(async () =>
          cleaner(this).then(res => this.progress('cleaner', res)),
        ),
      Promise.resolve(),
    );
    return result;
  }

  async runFeature(feature: SkippableFeature): Promise<FeatureResult> {
    await this.progress('feature', feature.name);
    if (feature.skip) {
      return {
        feature,
        success: true,
        scenarioResults: [],
      };
    }
    const startRun = Date.now();
    const scenarioResults: ScenarioResult[] = [];
    await feature.children.reduce(
      (promise, scenario) =>
        promise.then(async () => {
          if (
            scenarioResults.length &&
            !scenarioResults[scenarioResults.length - 1].success
          ) {
            scenarioResults.push({
              success: false,
              scenario,
              tries: 0,
              stepResults: [],
              skipped: true,
            });
            return;
          }
          scenarioResults.push(await this.retryScenario(scenario));
        }),
      Promise.resolve(),
    );
    return {
      success: scenarioResults.reduce(allSuccess, true),
      runTime: Date.now() - startRun,
      feature,
      scenarioResults,
    };
  }

  /**
   * Runs a scenario and retries it with a backoff
   */
  async retryScenario(scenario: Scenario): Promise<ScenarioResult> {
    return new Promise<ScenarioResult>(async resolve => {
      // Run the scenario without delay
      let lastResult: ScenarioResult = await this.runScenario(scenario);
      if (lastResult.success) {
        return resolve(lastResult);
      }
      // Now retry it, up to 31 seconds
      const b = exponential({
        randomisationFactor: 0,
        initialDelay: 1000,
        maxDelay: 16000,
      });
      b.failAfter(5);
      b.on('ready', async num => {
        const r = await this.runScenario(scenario);
        lastResult = {
          ...r,
          tries: num + 1,
        };
        if (lastResult.success) {
          return resolve(lastResult);
        }
        this.progress('retry', scenario.name);
        // Retry scenario until timeout
        b.backoff();
      });
      b.on('fail', () => {
        resolve(lastResult);
      });
      b.backoff();
    });
  }

  async runScenario(scenario: Scenario): Promise<ScenarioResult> {
    await this.progress('scenario', scenario.name);
    const startRun = Date.now();
    const stepResults: StepResult[] = [];
    let abort = false;
    await scenario.steps.reduce(
      (promise, step) =>
        promise
          .then(async () => {
            if (abort) {
              stepResults.push({
                skipped: true,
                success: false,
                step: {
                  ...step,
                  interpolatedText: step.text,
                },
              });
            } else {
              stepResults.push(await this.runStep(step));
            }
          })
          .catch(async error => {
            await this.progress('step error', error);
            stepResults.push({
              success: false,
              step: {
                ...step,
                interpolatedText: step.text,
              },
              error,
              skipped: false,
            });
            // Skip further steps
            abort = true;
          }),
      Promise.resolve(),
    );
    return {
      success: stepResults.reduce(allSuccess, true),
      runTime: Date.now() - startRun,
      scenario,
      stepResults,
      tries: 1,
      skipped: false,
    };
  }

  async runStep(step: Step): Promise<StepResult> {
    await this.progress('step', step.text);
    const interpolatedStep = {
      ...step,
      interpolatedText: this.replaceStoragePlaceholders(step.text),
      interpolatedArgument: step.argument
        ? this.replaceStoragePlaceholders(step.argument.content)
        : undefined,
    };

    if (afterRx.test(step.text)) {
      return {
        success: true,
        step: interpolatedStep,
        skipped: false,
      };
    }

    const matchedRunner: {
      runner: StepRunner<W>;
      args: string[];
    } = this.stepRunners.reduce((matchedRunner: any, runner) => {
      if (matchedRunner) {
        return matchedRunner;
      }
      const args = runner.willRun(interpolatedStep);
      if (args) {
        return {
          runner,
          args,
        };
      }
    }, undefined);

    if (!matchedRunner) {
      throw new StepRunnerNotDefinedError(interpolatedStep);
    }
    const startRun = Date.now();

    const result = await matchedRunner.runner.run(
      matchedRunner.args,
      interpolatedStep,
      this,
    );

    return {
      success: true,
      runTime: Date.now() - startRun,
      step: interpolatedStep,
      result,
      skipped: false,
    };
  }

  /**
   * Replace {foo} storage placeholders
   */
  private replaceStoragePlaceholders(text: string): string {
    const data = {
      ...this.world,
      ...this.store,
    };
    const interpolated = Object.keys(data).reduce(
      (str, key) => str.replace(new RegExp(`{${key}}`, 'g'), data[key]),
      text,
    );
    const missed = interpolated.match(/\{[^}\W]+\}/g);
    if (missed && missed.length) {
      throw new StoreKeyUndefinedError(missed.map(k => k.slice(1, -1)), data);
    }
    return interpolated;
  }
}

export interface Reporter {
  report(result: RunResult): Promise<void>;

  progress(type: string, info?: string): Promise<void>;
}

export type StepResult = Result & {
  step: InterpolatedStep;
  skipped: boolean;
  result?: any;
  error?: Error | Chai.AssertionError;
};

export type ScenarioResult = Result & {
  scenario: Scenario;
  stepResults: StepResult[];
  tries: Number;
  skipped: boolean;
};

export type FeatureResult = Result & {
  feature: SkippableFeature;
  scenarioResults: ScenarioResult[];
};

export type RunResult = Result & {
  featureResults: FeatureResult[];
};

export type Result = {
  success: boolean;
  runTime?: Number;
  error?: Error;
};

export type StepRunner<W extends Store> = {
  /**
   * Determines whether this instance will run the step.
   *
   * If not returns false, otherwise the returned list will be passed as arguments to the run method
   */
  willRun: (step: InterpolatedStep) => false | string[];

  run: StepRunnerFunc<W>;
};

export type StepRunnerFunc<W extends Store> = (
  args: string[],
  step: InterpolatedStep,
  runner: FeatureRunner<W>,
) => Promise<any>;

export type InterpolatedStep = Step & {
  interpolatedText: string;
  interpolatedArgument?: string;
};

export class StepRunnerNotDefinedError extends Error {
  step: InterpolatedStep;

  constructor(step: InterpolatedStep) {
    super('No runner defined for this step!');
    this.step = step;
    this.name = StepRunnerNotDefinedError.name;
    Error.captureStackTrace(this, StepRunnerNotDefinedError);
    Object.setPrototypeOf(this, StepRunnerNotDefinedError.prototype);
  }
}

export class RetryError extends Error {
  step: InterpolatedStep;

  constructor(step: InterpolatedStep) {
    super('Retrying step failed!');
    this.step = step;
    this.name = RetryError.name;
    Error.captureStackTrace(this, RetryError);
    Object.setPrototypeOf(this, RetryError.prototype);
  }
}

export class StoreKeyUndefinedError extends Error {
  store: Store;
  keys: string[];

  constructor(keys: string[], store: Store) {
    super(`"${keys.join('"')}" is not defined in the store!`);
    this.keys = keys;
    this.store = store;
    this.name = StoreKeyUndefinedError.name;
    Error.captureStackTrace(this, StoreKeyUndefinedError);
    Object.setPrototypeOf(this, StoreKeyUndefinedError.prototype);
  }
}

export type Store = {
  [key: string]: any;
};
