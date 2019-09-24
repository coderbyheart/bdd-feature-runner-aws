import * as jsonata from 'jsonata'
import { expect } from 'chai'
import { regexGroupMatcher } from '../lib/regexGroupMatcher'
import { StepRunner } from '../lib/runner'

export const storageStepRunners = (): StepRunner<any>[] => [
	regexGroupMatcher(
		/^(?:"(?<exp>[^"]+)" of )?"(?<storeName>[^"]+)" (?<equalOrMatch>equal|match) this JSON$/,
	)(async ({ exp, equalOrMatch, storeName }, step, runner) => {
		if (!step.interpolatedArgument) {
			throw new Error('Must provide argument!')
		}
		const j = JSON.parse(step.interpolatedArgument)
		const result = runner.store[storeName]
		const fragment = exp ? jsonata(exp).evaluate(result) : result
		if (equalOrMatch === 'match') {
			expect(fragment).to.containSubset(j)
		} else {
			expect(fragment).to.deep.equal(j)
		}
		return [fragment]
	}),
	regexGroupMatcher(/^I escape this JSON into "(?<storeName>[^"]+)"$/)(
		async ({ storeName }, step, runner) => {
			if (!step.interpolatedArgument) {
				throw new Error('Must provide argument!')
			}
			const j = JSON.parse(step.interpolatedArgument)
			runner.store[storeName] = JSON.stringify(JSON.stringify(j))
			return runner.store[storeName]
		},
	),
]
