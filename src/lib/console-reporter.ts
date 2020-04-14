import {
	FeatureResult,
	Reporter,
	RunResult,
	ScenarioResult,
	StepResult,
	StepRunnerNotDefinedError,
} from './runner'
import * as chalk from 'chalk'
import * as Chai from 'chai'
import { messages as cucumber } from 'cucumber-messages'

export type Config = {
	printResults: boolean
	printProgress: boolean
	printSummary: boolean
	printProgressTimestamps?: boolean
	console?: Console
}

export type Console = {
	log: (...args: any) => void
	error: (...args: any) => void
}

export class ConsoleReporter implements Reporter {
	private readonly config: Config
	private lastProgress?: number
	private readonly console: Console

	constructor(config?: Partial<Config>) {
		this.config = {
			...{
				printResults: false,
				printProgress: false,
				printProgressTimestamps: false,
				printSummary: false,
			},
			...config,
		}
		this.console = config?.console ?? console
	}

	async report(result: RunResult) {
		const featureReporter = reportFeature(this.console)
		const scenarioReporter = reportScenario(this.console)
		const stepReporter = reportStep(this.console)
		const runResultReporter = reportRunResult(this.console)

		result.featureResults.forEach(featureResult => {
			featureReporter(featureResult)
			featureResult.scenarioResults.forEach(scenarioResult => {
				scenarioReporter(scenarioResult)
				scenarioResult.stepResults.forEach(stepResult => {
					stepReporter(stepResult, this.config)
				})
			})
		})

		if (this.config.printSummary) {
			const summaryReporter = reportSummary(this.console)
			summaryReporter(result)
		}

		runResultReporter(result.success, result.runTime)
		if (result.error) {
			this.console.error(
				' ',
				chalk.red.bold(' 🚨 '),
				chalk.yellow(result.error.message),
			)
		}
	}

	async progress(type: string, info?: string) {
		if (!this.config.printProgress) {
			return
		}
		const i = [' ']
		if (this.config.printProgressTimestamps) {
			i.push(chalk.grey(`[${new Date().toISOString()}]`))
		}
		i.push(chalk.magenta(' ℹ '), chalk.cyan(type))
		if (info) {
			i.push(chalk.grey(info))
		}
		if (this.lastProgress) {
			i.push(chalk.blue(`⏱ +${Date.now() - this.lastProgress}ms`))
		}
		this.lastProgress = Date.now()
		this.console.log(...i)
	}
}

const reportFeature = (console: Console) => (result: FeatureResult) => {
	console.log('')
	const i = []

	if (result.feature.skip) {
		i.push(
			'',
			chalk.yellow.strikethrough.dim(`${result.feature.name}`),
			chalk.magenta('↷ (skipped)'),
		)
	} else {
		console.log(
			'',
			chalk.gray('Feature: '),
			chalk.yellow.bold(`${result.feature.name}`),
		)
		console.log('')

		i.push(result.success ? chalk.green(' 💯') : chalk.red.bold(' ❌'))

		if (result.runTime) {
			i.push(chalk.blue(`⏱ ${result.runTime}ms`))
		}
	}
	if (result.feature.tags?.length) {
		i.push(result.feature.tags.map(({ name }) => chalk.blueBright(`${name}`)))
	}
	console.log(...i)
}

const reportScenario = (console: Console) => (result: ScenarioResult) => {
	console.log('')
	const type =
		result.scenario instanceof cucumber.GherkinDocument.Feature.Background
			? 'Background'
			: 'Scenario'
	const i = [chalk.gray(type) + ':']
	if (result.skipped) {
		i.push(chalk.magenta(' ↷ '), chalk.magenta('(skipped)'))
		if (result.scenario.name) {
			i.push(chalk.gray(result.scenario.name))
		}
	} else {
		if (result.scenario.name) {
			i.push(chalk.yellow(result.scenario.name))
		}
		if (result.runTime) {
			i.push(chalk.blue(`⏱ ${result.runTime}ms`))
		}
		if (result.tries > 1) {
			i.push(chalk.red(`⏱ ${result.tries}x`))
		}
	}
	console.log('', ...i)
	console.log('')
}

const reportRunResult = (console: Console) => (
	success: boolean,
	runTime?: number,
) => {
	console.log('')
	const i = [
		success ? chalk.green(' 💯 ALL PASS 👍 ') : chalk.red.bold(' ❌ FAIL 👎 '),
	]
	if (runTime) {
		i.push(chalk.blue(`⏱ ${runTime}ms`))
	}
	if (success) {
		i.push('')
	}
	console.log(' ', ...i)
	console.log('')
}

const reportStep = (console: Console) => (
	result: StepResult,
	config: Config,
) => {
	const i = [' ']
	if (result.skipped) {
		i.push(chalk.gray(' ↷ '))
		i.push(chalk.gray(result.step.interpolatedText))
		i.push(chalk.magenta('(skipped)'))
	} else {
		if (result.success) {
			i.push(chalk.green(' ✔ '))
			i.push(chalk.yellow(result.step.interpolatedText))
			if (result.runTime) {
				i.push(chalk.blue(`⏱ ${result.runTime}ms`))
			}
		} else {
			i.push(chalk.red.bold(' ❌ '))
			i.push(chalk.red.bold(result.step.interpolatedText))
		}
	}
	console.log(...i)
	if (result.step.interpolatedArgument) {
		console.log(
			chalk.yellow.dim('   ▶ '),
			chalk.yellow.dim(
				result.step.interpolatedArgument.replace(/\n\s*/g, ' ').trimLeft(),
			),
		)
	}
	if (result.result && config.printResults) {
		;[
			...(Array.isArray(result.result) ? result.result : [result.result]),
		].forEach(r => {
			console.log(chalk.cyan('   ◀ '), chalk.cyan(JSON.stringify(r)))
		})
	}
	if (result.error) {
		if (
			result.error instanceof StepRunnerNotDefinedError &&
			result.error.step.interpolatedText !== result.error.step.text
		) {
			console.log(
				chalk.grey('   ▶'),
				chalk.grey(result.error.step.interpolatedText),
			)
		}
		console.error(
			' ',
			chalk.red.bold(' 🚨 '),
			chalk.yellow.bold('👆'),
			chalk.yellow(result.error.message),
		)
		if (result.error instanceof Chai.AssertionError) {
			console.log(
				chalk.green('   Expected:'),
				JSON.stringify((result.error as any).expected),
			)
			console.log(
				chalk.red.bold('   Actual:  '),
				JSON.stringify((result.error as any).actual),
			)
		}
	}
}

const reportSummary = (console: Console) => (result: RunResult) => {
	const featureReporter = reportFeature(console)
	const scenarioReporter = reportScenario(console)
	const features = result.featureResults.length
	let featuresSkipped = 0
	let featureFailures = 0
	let scenarios = 0
	let scenariosSkipped = 0
	let scenarioFailures = 0
	let featureFailed = false
	result.featureResults.forEach(featureResult => {
		featureFailed = false
		if (featureResult.feature.skip) {
			featuresSkipped++
		} else if (!featureResult.success) {
			featureFailures++
			featureFailed = true
			featureReporter(featureResult)
		}
		featureResult.scenarioResults.forEach(scenarioResult => {
			scenarios++
			if (featureResult.feature.skip || scenarioResult.skipped) {
				scenariosSkipped++
			} else if (featureFailed && !scenarioResult.success) {
				scenarioFailures++
				scenarioReporter(scenarioResult)
			}
		})
	})
	const featuresPassed = features - featuresSkipped - featureFailures
	const scenariosPassed = scenarios - scenariosSkipped - scenarioFailures

	const colorIf = (color: chalk.Chalk, defaultColor = chalk.green) => (
		cond: (n: number) => boolean,
		n: number,
		c = n,
	) => (cond(c) ? color(n) : defaultColor(n))
	const redIf = colorIf(chalk.redBright.bold)
	const yellowIf = colorIf(chalk.yellow, chalk.gray)

	console.log('')
	console.log(
		'',
		chalk.gray('Feature Summary:  '),
		redIf(n => n > 0, featureFailures),
		chalk.gray('failed,'),
		yellowIf(n => n > 0, featuresSkipped),
		chalk.gray('skipped,'),
		redIf(n => n > 0, featuresPassed, featureFailures),
		chalk.gray('passed,'),
		chalk.gray(`${features} total`),
	)
	console.log(
		'',
		chalk.gray('Scenario Summary: '),
		redIf(n => n > 0, scenarioFailures),
		chalk.gray('failed,'),
		yellowIf(n => n > 0, scenariosSkipped),
		chalk.gray('skipped,'),
		redIf(n => n > 0, scenariosPassed, scenarioFailures),
		chalk.gray('passed,'),
		chalk.gray(
			`${scenarios} total${
				featuresSkipped ? ` (for non-skipped features)` : ''
			}`,
		),
	)
}
