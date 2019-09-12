import * as AWS from 'aws-sdk'
import { StepRunner } from '../lib/runner'
import { regexMatcher } from '../lib/regexMatcher'
import { expect } from 'chai'
import * as jsonata from 'jsonata'

/**
 * BDD steps for using the AWS SDK directly
 */
export const awsSdkStepRunners = <W>({
	region,
}: {
	region: string
}): StepRunner<W>[] => [
	{
		willRun: regexMatcher(
			/^I execute "([^"]+)" of the AWS ([^ ]+) SDK( with)$/,
		),
		run: async ([method, api, withArgs], step, runner) => {
			let argument
			if (withArgs) {
				if (!step.interpolatedArgument) {
					throw new Error('Must provide argument!')
				}
				argument = JSON.parse(step.interpolatedArgument)
			}
			await runner.progress(
				'AWS-SDK',
				`${api}.${method}(${JSON.stringify(argument)})`,
			)
			// @ts-ignore
			const a = new AWS[api]({
				region,
			})
			const res = await a[method](argument).promise()
			runner.store.awsSdk = {
				res,
			}
			return res
		},
	},
	{
		willRun: regexMatcher(
			/^(?:"([^"]+)" of )?the execution result should (equal|match) this JSON$/,
		),
		run: async ([exp, equalOrMatch], step, runner) => {
			const { awsSdk } = runner.store
			if (!step.interpolatedArgument) {
				throw new Error('Must provide argument!')
			}
			const j = JSON.parse(step.interpolatedArgument)
			const result = awsSdk.res
			const fragment = exp ? jsonata(exp).evaluate(result) : result
			if (equalOrMatch === 'match') {
				expect(fragment).to.containSubset(j)
			} else {
				expect(fragment).to.deep.equal(j)
			}
			return [fragment]
		},
	},
]
