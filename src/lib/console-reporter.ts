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

type Config = {
	printResults: boolean
	printProgress: boolean
	printProgressTimestamps?: boolean
}

export class ConsoleReporter implements Reporter {
	private readonly config: Config
	private lastProgress?: number

	constructor(
		config: Config = {
			printResults: false,
			printProgress: false,
			printProgressTimestamps: false,
		},
	) {
		this.config = config
	}

	async report(result: RunResult) {
		console.log('')
		console.log('-----------------------------')
		console.log('Feature Tests Detailed Results')
		console.log('-----------------------------')
		console.log('')
		result.featureResults.forEach(featureResult => {
			reportFeature(featureResult)
			featureResult.scenarioResults.forEach(scenarioResult => {
				reportScenario(scenarioResult)
				scenarioResult.stepResults.forEach(stepResult => {
					reportStep(stepResult, this.config)
				})
			})
		})
		console.log('')
		console.log('--------------------------------')
		console.log('Feature Tests Summary of Failures')
		console.log('--------------------------------')
		console.log('')
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
				reportFeature(featureResult)
			}
			featureResult.scenarioResults.forEach(scenarioResult => {
				scenarios++
				if (featureResult.feature.skip || scenarioResult.skipped) {
					scenariosSkipped++
				} else if (featureFailed && !scenarioResult.success) {
					scenarioFailures++
					reportScenario(scenarioResult)
				}
			})
		})
		const featuresPassed = features - featuresSkipped - featureFailures
		const scenariosPassed = scenarios - scenariosSkipped - scenarioFailures
		console.log(
			`Feature Summary:  ${featureFailures} failed, ${featuresSkipped} skipped, ` +
				`${featuresPassed} passed, ${features} total`,
		)
		console.log(
			`Scenario Summary: ${scenarioFailures} failed, ${scenariosSkipped} skipped, ` +
				`${scenariosPassed} passed, ${scenarios} total ` +
				(featuresSkipped ? `(for non-skipped features)` : ''),
		)
		reportRunResult(result.success, result.runTime)
		if (result.error) {
			console.error(
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
		console.log(...i)
	}
}

const reportFeature = (result: FeatureResult) => {
	console.log('')
	const i = []

	if (result.feature.skip) {
		i.push(
			'',
			chalk.yellow.strikethrough.dim(`${result.feature.name}`),
			chalk.magenta('↷ (skipped)'),
		)
	} else {
		console.log('', 'Feature: ', chalk.yellow.bold(`${result.feature.name}`))
		console.log('')

		i.push(result.success ? ' 💚' : ' ❌')
		if (result.runTime) {
			i.push(chalk.blue(`⏱ ${result.runTime}ms`))
		}
	}
	if (result.feature.tags?.length) {
		i.push(result.feature.tags.map(({ name }) => chalk.blueBright(`${name}`)))
	}
	console.log(...i)
}

const reportScenario = (result: ScenarioResult) => {
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

const reportRunResult = (success: boolean, runTime?: number) => {
	console.log('')
	const i = [
		success ? chalk.green(' 💚 ALL PASS 👍 ') : chalk.red.bold(' ❌ FAIL 👎 '),
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

const reportStep = (result: StepResult, config: Config) => {
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
