import { afterRx } from './runner'

const Gherkin = require('gherkin')
const toposort = require('toposort')
import * as globAsync from 'glob'
import { promisify } from 'util'
import * as path from 'path'

const glob = promisify(globAsync)
import { readFileSync } from 'fs'

const parser = new Gherkin.Parser(new Gherkin.AstBuilder())
const matcher = new Gherkin.TokenMatcher()

export type Step = {
	type: 'Step'
	text: string
	argument?: { type: 'DocString'; content: string }
}
export type Scenario = {
	type: 'Background' | 'Scenario' | 'ScenarioOutline'
	name: string
	steps: Step[]
	argument: string
	keyword: string
	examples?: Example[]
}
export type Feature = {
	type: 'Feature'
	name: string
	children: Scenario[]
	tags: { type: 'Tag'; name: string }[]
}
export type Example = {
	type: 'Example'
	keyword: string
	name: string
	description?: string
	tableHeader: TableRow
	tableBody: TableRow[]
}
export type TableRow = {
	type: 'TableRow'
	cells: Cell[]
}
export type Cell = {
	type: 'TableCell'
	value: string
}

export type SkippableFeature = Feature & {
	skip: boolean
}

export const parseFeatures = (featureData: Buffer[]): SkippableFeature[] => {
	const parsedFeatures: Feature[] = featureData.map(d => {
		// Parse the feature files
		const scanner = new Gherkin.TokenScanner(d.toString())
		return parser.parse(scanner, matcher).feature
	})
	const featureNames = parsedFeatures.map(({ name }) => name)
	// Sort the features by the step 'I am run after the "..." feature' using toposort
	const featureDependencies = parsedFeatures.map(feature => {
		const bg = feature.children.find(({ type }) => type === 'Background')
		if (bg) {
			const afterStep = bg.steps.find(({ text }) => afterRx.test(text))
			if (afterStep) {
				const m = afterRx.exec(afterStep.text)
				if (!m) {
					throw new Error(`Failed to find feature in ${afterStep.text}`)
				}
				if (!featureNames.includes(m[1])) {
					throw new Error(
						`The feature ${m[1]} you want to run after does not exist!`,
					)
				}
				return [m[1], feature.name]
			}
		}
		return [feature.name, false]
	})
	const sortedFeatureNames = toposort(featureDependencies).filter(
		(feature?: any) => feature,
	)

	// Now bring the features in the right order
	const sortedFeatures: Feature[] = sortedFeatureNames.map(
		(featureName: string) =>
			parsedFeatures.find(({ name }) => name === featureName),
	)

	// Find features to be skipped
	const only = parsedFeatures
		.filter(({ tags }) => tags.find(({ name }) => name === '@Only'))
		.map(({ name }) => name)

	return sortedFeatures.map(f => {
		const { tags, name: featureName } = f
		const skip =
			tags.find(({ name }) => name === '@Skip') ||
			(only.length && !only.includes(featureName))
		return {
			...f,
			skip: !!skip,
		}
	})
}

export const fromDirectory = async (
	dir: string,
): Promise<SkippableFeature[]> => {
	const scan = path.join(path.resolve(dir), '*.feature')
	const featureFiles = await glob(scan)
	return parseFeatures(featureFiles.map(f => readFileSync(f)))
}
