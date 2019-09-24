import * as AWS from 'aws-sdk'
import { regexMatcher } from '../lib/regexMatcher'
import { expect } from 'chai'
import * as jsonata from 'jsonata'
import * as cognito from './cognito'

/**
 * BDD steps for using the AWS SDK directly
 */
export const awsSdkStepRunners = ({
	region,
	constructorArgs,
}: {
	region: string
	constructorArgs?: {
		[key: string]: {
			[key: string]: string
		}
	}
}) => [
	regexMatcher(/^I execute "([^"]+)" of the AWS ([^ ]+) SDK( with)?$/)(
		async ([method, api, withArgs], step, runner, flightRecorder) => {
			let argument
			if (withArgs) {
				if (!step.interpolatedArgument) {
					throw new Error('Must provide argument!')
				}
				try {
					argument = JSON.parse(step.interpolatedArgument)
				} catch {
					throw new Error(
						`Failed to parse argument: ${step.interpolatedArgument}`,
					)
				}
			}
			let extraArgs = {} as any
			const cognitoEnabled = flightRecorder.flags[cognito.cognitoAuthentication]
			if (cognitoEnabled) {
				const {
					secretAccessKey,
					identityId,
					accessKeyId,
					sessionToken,
				} = flightRecorder.settings[
					cognito.cognitoAuthentication
				] as cognito.FlightRecorderSettings
				extraArgs = {
					credentials: {
						secretAccessKey,
						identityId,
						accessKeyId,
						sessionToken,
					},
				}
				await runner.progress(
					`AWS-SDK.${api}.auth`,
					extraArgs.credentials.identityId,
				)
			}
			const args = {
				region,
				...(constructorArgs && constructorArgs[api]),
				...extraArgs,
			}
			// @ts-ignore
			const a = new AWS[api](args)
			await runner.progress(
				`AWS-SDK.${api}`,
				`${method}(${argument !== undefined ? JSON.stringify(argument) : ''})`,
			)
			const res = await a[method](argument).promise()
			runner.store.awsSdk = {
				res,
			}
			return res
		},
	),
	regexMatcher(
		/^(?:"([^"]+)" of )?the execution result should (equal|match) this JSON$/,
	)(async ([exp, equalOrMatch], step, runner) => {
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
	}),
	regexMatcher(
		/^(?:"([^"]+)" of )?the execution result should equal ([0-9]+)$/,
	)(async ([exp, num], _, runner) => {
		const { awsSdk } = runner.store
		const result = awsSdk.res
		const fragment = exp ? jsonata(exp).evaluate(result) : result
		expect(fragment).to.equal(parseInt(num, 10))
		return [fragment]
	}),
	regexMatcher(/^I store "([^"]+)" of the execution result as "([^"]+)"$/)(
		async ([expression, storeName], _, runner) => {
			const e = jsonata(expression)
			const { awsSdk } = runner.store
			const result = e.evaluate(awsSdk.res)
			expect(result).to.not.be.an('undefined')
			runner.store[storeName] = result
			return result
		},
	),
	regexMatcher(/^I parse "([^"]+)" of the execution result into "([^"]+)"$/)(
		async ([expression, storeName], _, runner) => {
			const e = jsonata(expression)
			const { awsSdk } = runner.store
			const result = e.evaluate(awsSdk.res)
			expect(result).to.not.be.an('undefined')
			runner.store[storeName] = JSON.parse(result)
			return runner.store[storeName]
		},
	),
]
