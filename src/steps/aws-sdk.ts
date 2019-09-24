import * as AWS from 'aws-sdk'
import { regexMatcher } from '../lib/regexMatcher'
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
]
