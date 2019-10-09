import {
	fromDirectory,
	SkippableFeature,
} from './load-features'
import { ConsoleReporter } from './console-reporter'
import { exponential } from 'backoff'
import { messages as cucumber } from 'cucumber-messages'

const allSuccess = (r: boolean, result: Result) => (result.success ? r : false)

export type FlightRecorder = {
	flags: { [key: string]: boolean }
	settings: { [key: string]: any }
}

export const afterRx = /^I am run after the "([^"]+)" feature$/

export type Cleaner = <W extends Store>(
	runner: FeatureRunner<W>,
) => Promise<any>

export class FeatureRunner<W extends Store> {
	private readonly featuresDir: string
	private readonly reporters: Reporter[]
	private readonly stepRunners: StepRunner<W>[] = []
	private readonly cleaners: Cleaner[] = []
	private readonly retry: boolean
	public store: Store
	public world: W

	constructor(
		world: W,
		options: {
			dir: string
			reporters?: Reporter[]
			store?: Store
			retry?: boolean
		},
	) {
		this.world = world
		this.featuresDir = options.dir
		this.reporters = options.reporters || [new ConsoleReporter()]
		this.store = options.store || {}
		this.retry = options.retry === undefined ? true : options.retry
	}

	addStepRunners(runners: StepRunner<W>[]): FeatureRunner<W> {
		this.stepRunners.push(...runners)
		return this
	}

	cleanup(fn: Cleaner) {
		this.cleaners.push(fn)
	}

	async progress(type: string, info?: string) {
		await Promise.all(
			this.reporters.map(reporter => reporter.progress(type, info)),
		)
	}

	async run(): Promise<RunResult> {
		const features = await fromDirectory(this.featuresDir)
		const startRun = Date.now()
		const featureResults: FeatureResult[] = []
		await features.reduce(
			(promise, feature) =>
				promise.then(async () => {
					let skip = false
					if (feature.dependsOn.length) {
						const depNames = feature.dependsOn.map(({ name }) => name)

						const dependendRuns = featureResults.filter(
							({ feature: { name } }) => depNames.includes(name),
						)
						skip = !dependendRuns.reduce((allSucceeded, dep) => {
							if (!allSucceeded) return allSucceeded
							return dep.success
						}, true)
					}
					if (skip) {
						// Skip feature if dependent fails
						featureResults.push({
							feature: {
								...feature,
								skip: true,
							},
							scenarioResults: [],
							success: false,
						})
					} else {
						featureResults.push(await this.runFeature(feature))
					}
				}),
			Promise.resolve(),
		)
		const result: RunResult = {
			success: featureResults.reduce(allSuccess, true),
			runTime: Date.now() - startRun,
			featureResults,
			store: this.store,
		}
		await Promise.all(this.reporters.map(reporter => reporter.report(result)))
		await this.cleaners.reduce(
			(promise, cleaner) =>
				promise.then(async () =>
					cleaner(this).then(res => this.progress('cleaner', res)),
				),
			Promise.resolve(),
		)
		return result
	}

	async runFeature(feature: SkippableFeature): Promise<FeatureResult> {
		await this.progress('feature', `${feature.name}`)
		if (feature.skip) {
			return {
				feature,
				success: true,
				scenarioResults: [],
			}
		}
		const startRun = Date.now()
		const scenarioResults: ScenarioResult[] = []
		const flightRecorder: FlightRecorder = {
			flags: {},
			settings: {},
		} as const
		await (feature?.children ?? []).reduce(
			(promise, scenario) =>
				promise.then(async () => {
					if (
						scenarioResults.length &&
						!scenarioResults[scenarioResults.length - 1].success
					) {
						scenarioResults.push({
							success: false,
							scenario: scenario as cucumber.GherkinDocument.Feature.IScenario,
							tries: 0,
							stepResults: [],
							skipped: true,
						})
						return
					}

					// This is a Scenario Outline with examples
					if (scenario.scenario?.examples?.length) {
						let scenarioOutline = scenario.scenario
						const example = scenarioOutline.examples?.[0]
						if (example) {
							const header = (example.tableHeader?.cells ?? []).map(({ value }) => value)
							await (example?.tableBody ?? []).reduce(
								(promise, example) =>
									promise.then(async () => {
										const values = (example?.cells ?? []).map(({ value }) => value)
										const replace = (str: string) =>
											header.reduce(
												(str, _, k) => str?.replace(`<${header[k]}>`, values?.[k] ?? ''),
												str,
											)
										const s: cucumber.GherkinDocument.Feature.IScenario = {
											keyword: 'Scenario',
											name: `${scenario.scenario?.name} (${values?.join(',')})`,
											steps: (scenario.scenario?.steps ?? []).map(step => ({
												...step,
												text: replace(step.text || ''),
												docString: step.docString
													? {
														...step.docString,
														content: replace(step.docString.content || ''),
													}
													: undefined,
											})),
										}
										if (this.retry) {
											scenarioResults.push(
												await this.retryScenario(s, flightRecorder),
											)
										} else {
											scenarioResults.push(
												await this.runScenario(s, flightRecorder),
											)
										}
									}),
								Promise.resolve(),
							)
						}
					} else {
						if (scenario.scenario) {
							if (this.retry) {
								scenarioResults.push(
									await this.retryScenario(scenario.scenario, flightRecorder),
								)
							} else {
								scenarioResults.push(
									await this.runScenario(scenario.scenario, flightRecorder),
								)
							}
						}
					}
				}),
			Promise.resolve(),
		)
		return {
			success: scenarioResults.reduce(allSuccess, true),
			runTime: Date.now() - startRun,
			feature,
			scenarioResults,
		}
	}

	/**
	 * Runs a scenario and retries it with a backoff
	 */
	async retryScenario(
		scenario: cucumber.GherkinDocument.Feature.IScenario,
		feature: FlightRecorder,
	): Promise<ScenarioResult> {
		/* eslint no-async-promise-executor: off */
		return new Promise<ScenarioResult>(async resolve => {
			// Run the scenario without delay
			let lastResult: ScenarioResult = await this.runScenario(scenario, feature)
			if (lastResult.success) {
				return resolve(lastResult)
			}
			// Now retry it, up to 31 seconds
			const b = exponential({
				randomisationFactor: 0,
				initialDelay: 1000,
				maxDelay: 16000,
			})
			b.failAfter(5)
			b.on('ready', async num => {
				const r = await this.runScenario(scenario, feature)
				lastResult = {
					...r,
					tries: num + 1,
				}
				if (lastResult.success) {
					return resolve(lastResult)
				}
				await this.progress('retry', `${scenario.name}`)
				// Retry scenario until timeout
				b.backoff()
			})
			b.on('fail', () => {
				resolve(lastResult)
			})
			b.backoff()
		})
	}

	async runScenario(
		scenario: cucumber.GherkinDocument.Feature.IScenario,
		feature: FlightRecorder,
	): Promise<ScenarioResult> {
		await this.progress('scenario', `${scenario.name}`)
		const startRun = Date.now()
		const stepResults: StepResult[] = []
		let abort = false
		await (scenario?.steps ?? []).reduce(
			(promise, step) =>
				promise
					.then(async () => {
						if (abort) {
							stepResults.push({
								skipped: true,
								success: false,
								step: {
									...step,
									interpolatedText: `${step.text}`,
								},
							})
						} else {
							stepResults.push(await this.runStep(step, feature))
						}
					})
					.catch(async error => {
						await this.progress('step error', error)
						stepResults.push({
							success: false,
							step: {
								...step,
								interpolatedText: `${step.text}`,
							},
							error,
							skipped: false,
						})
						// Skip further steps
						abort = true
					}),
			Promise.resolve(),
		)
		return {
			success: stepResults.reduce(allSuccess, true),
			runTime: Date.now() - startRun,
			scenario,
			stepResults,
			tries: 1,
			skipped: false,
		}
	}

	async runStep(step: cucumber.GherkinDocument.Feature.IStep, feature: FlightRecorder): Promise<StepResult> {
		await this.progress('step', `${step.text}`)
		const interpolatedStep = {
			...step,
			interpolatedText: this.replaceStoragePlaceholders(`${step.text}`),
			interpolatedArgument: step.docString
				? this.replaceStoragePlaceholders(`${step.docString.content}`)
				: undefined,
		}

		if (afterRx.test(`${step.text}`)) {
			return {
				success: true,
				step: interpolatedStep,
				skipped: false,
			}
		}

		const matchedRunner = this.stepRunners.reduce(
			(matchedRunner, runner) => {
				if (matchedRunner) {
					return matchedRunner
				}
				const r = runner(interpolatedStep)
				if (r) {
					return r
				}
				return undefined
			},
			undefined as (undefined | StepRunnerFunc<W>),
		)

		if (!matchedRunner) {
			throw new StepRunnerNotDefinedError(interpolatedStep)
		}
		const startRun = Date.now()

		const result = await matchedRunner(this, feature)

		return {
			success: true,
			runTime: Date.now() - startRun,
			step: interpolatedStep,
			result,
			skipped: false,
		}
	}

	/**
	 * Replace {foo} storage placeholders
	 */
	private replaceStoragePlaceholders(text: string): string {
		const data = {
			...this.world,
			...this.store,
		}
		const interpolated = Object.keys(data).reduce(
			(str, key) => str.replace(new RegExp(`{${key}}`, 'g'), data[key]),
			text,
		)
		const missed = interpolated.match(/\{[^}\W]+\}/g)
		if (missed && missed.length) {
			throw new StoreKeyUndefinedError(missed.map(k => k.slice(1, -1)), data)
		}
		return interpolated
	}
}

export type Reporter = {
	report(result: RunResult): Promise<void>

	progress(type: string, info?: string): Promise<void>
}

export type StepResult = Result & {
	step: InterpolatedStep
	skipped: boolean
	result?: any
	error?: Error | Chai.AssertionError
}

export type ScenarioResult = Result & {
	scenario: cucumber.GherkinDocument.Feature.IBackground | cucumber.GherkinDocument.Feature.IScenario
	stepResults: StepResult[]
	tries: number
	skipped: boolean
}

export type FeatureResult = Result & {
	feature: SkippableFeature
	scenarioResults: ScenarioResult[]
}

export type RunResult = Result & {
	featureResults: FeatureResult[]
	store: Store
}

export type Result = {
	success: boolean
	runTime?: number
	error?: Error
}

/**
 * Determines whether this instance will run the step.
 *
 * If not returns false, otherwise the returned list will be passed as arguments to the run method
 */
export type StepRunner<W extends Store> = (
	step: InterpolatedStep,
) => false | StepRunnerFunc<W>

export type StepRunnerFunc<W extends Store> = (
	runner: FeatureRunner<W>,
	feature: FlightRecorder,
) => Promise<any>

export type InterpolatedStep = cucumber.GherkinDocument.Feature.IStep & {
	interpolatedText: string
	interpolatedArgument?: string
}

export class StepRunnerNotDefinedError extends Error {
	step: InterpolatedStep

	constructor(step: InterpolatedStep) {
		super('No runner defined for this step!')
		this.step = step
		this.name = StepRunnerNotDefinedError.name
		Error.captureStackTrace(this, StepRunnerNotDefinedError)
		Object.setPrototypeOf(this, StepRunnerNotDefinedError.prototype)
	}
}

export class RetryError extends Error {
	step: InterpolatedStep

	constructor(step: InterpolatedStep) {
		super('Retrying step failed!')
		this.step = step
		this.name = RetryError.name
		Error.captureStackTrace(this, RetryError)
		Object.setPrototypeOf(this, RetryError.prototype)
	}
}

export class StoreKeyUndefinedError extends Error {
	store: Store
	keys: string[]

	constructor(keys: string[], store: Store) {
		super(`"${keys.join('"')}" is not defined in the store!`)
		this.keys = keys
		this.store = store
		this.name = StoreKeyUndefinedError.name
		Error.captureStackTrace(this, StoreKeyUndefinedError)
		Object.setPrototypeOf(this, StoreKeyUndefinedError.prototype)
	}
}

export type Store = {
	[key: string]: any
}
