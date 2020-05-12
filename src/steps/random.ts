import { regexGroupMatcher } from '../lib/regexGroupMatcher'
import { v4 } from 'uuid'

export type RandomStringGenerators = { [key: string]: () => string }

export const randomStepRunners = (
	{ generators }: { generators: RandomStringGenerators } = {
		generators: { UUID: () => v4() },
	},
) => [
	regexGroupMatcher(
		/^I have a random (?<generatorId>[^ ]+) in "(?<storeName>[^"]+)"$/,
	)(async ({ generatorId, storeName }, _, runner) => {
		const generator = generators[generatorId as string]
		if (!generator) {
			throw new Error(`Unknown random string generator "${generatorId}"!`)
		}
		runner.store[storeName] = generator()
		return runner.store[storeName]
	}),
]
