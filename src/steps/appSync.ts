import {
	FeatureRunner,
	Store,
	InterpolatedStep,
	StepRunnerFunc,
} from '../lib/runner'
import { regexMatcher } from '../lib/regexMatcher'
import * as chai from 'chai'
import { expect } from 'chai'
import * as jsonata from 'jsonata'
import { AppSyncClient } from '../lib/appsync/appSyncClient'
import { queryWithIAM } from '../lib/appsync/queryWithIAM'
import { subscribe } from '../lib/appsync/subscribe'
import { queryWithApiKey } from '../lib/appsync/queryWithApiKey'
import { GQLQueryResult } from '../lib/gql-query-result'
import * as chaiSubset from 'chai-subset'

chai.use(chaiSubset)

export const appSyncBeforeAll = async <W extends Store>(
	runner: FeatureRunner<W>,
): Promise<AppSyncClient> => {
	runner.store.appSyncClient = AppSyncClient()
	return runner.store.appSyncClient
}

export const appSyncAfterAll = async <W extends Store>(
	runner: FeatureRunner<W>,
): Promise<void> => {
	Object.keys(runner.store.appSyncClient.subscriptions).forEach((id) =>
		runner.store.appSyncClient.subscriptions[id].disconnect(),
	)
}

/**
 * This returns a function to run GQL queries (e.g. against an AppSync endpoint)
 * by passing a GQL query string and key/value variables.
 */
export type GQLQueryFactory = (
	store: Store,
	client: AppSyncClient,
	userId?: string,
) => (
	gqlQuery: string,
	variables?: { [key: string]: string },
) => Promise<GQLQueryResult>

/**
 * Run query against an Appsync endpoint, using either API Key or Cognito w/SignatureV4 auth
 */
const getAppSyncQuery: GQLQueryFactory = (
	store: Store,
	client: AppSyncClient,
	userId?: string,
) => {
	if (client.authorization === 'API_KEY') {
		if (userId !== undefined) {
			throw new Error('API_KEY authorization does not support user argument!')
		}
		return queryWithApiKey(client.apiKey!, client.endpoint)
	} else {
		const prefix = userId !== undefined ? `cognito:${userId}` : `cognito`
		const {
			[`${prefix}:AccessKeyId`]: AccessKeyId,
			[`${prefix}:SecretKey`]: SecretKey,
			[`${prefix}:SessionToken`]: SessionToken,
		} = store

		return queryWithIAM(AccessKeyId, SecretKey, SessionToken, client.endpoint)
	}
}

/**
 * BDD steps for interacting with an AWS Appsync GQL API
 */
export const appSyncStepRunners = (
	{ getQuery }: { getQuery: GQLQueryFactory } = { getQuery: getAppSyncQuery },
): ((step: InterpolatedStep) => false | StepRunnerFunc<Store>)[] => [
	regexMatcher(/^the GQL endpoint is "([^"]+)"$/)(
		async ([endpoint], _, runner) => {
			const { appSyncClient: client } = runner.store
			client.endpoint = endpoint
		},
	),
	regexMatcher(/^I execute this GQL query(?: as "([^"]+)")?$/)(
		async ([userId], step, runner) => {
			const { appSyncClient: client } = runner.store
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			const q = step.interpolatedArgument.replace(/\n\s*/g, ' ')
			await runner.progress('GQL>', q)

			const query = getQuery(runner.store, client, userId)

			const { result, operation, selection } = await query(q, client.variables)
			client.variables = {}
			client.response = result
			client.operation = operation
			client.selection = selection
			await runner.progress('<GQL', JSON.stringify(result))
			return [q, result]
		},
	),
	regexMatcher(/^the GQL query result should not contain errors$/)(
		async (_, __, runner) => {
			const { appSyncClient: client } = runner.store
			expect(client.response).to.not.have.property('errors')
		},
	),
	regexMatcher(/^the GQL query result should contain this error$/)(
		async (_, step, runner) => {
			const { appSyncClient: client } = runner.store
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			expect(client.response).to.have.property('errors')
			expect(client.response.errors).to.containSubset([
				JSON.parse(step.interpolatedArgument),
			])
		},
	),
	// This checks the entire response
	regexMatcher(
		/^(?:"([^"]+)" of )?the GQL response should (equal|match) this JSON$/,
	)(async ([exp, equalOrMatch], step, runner) => {
		const { appSyncClient: client } = runner.store
		if (step.interpolatedArgument === undefined) {
			throw new Error('Must provide argument!')
		}
		const j = JSON.parse(step.interpolatedArgument)
		const result = client.response
		const fragment = exp ? jsonata(exp).evaluate(result) : result
		if (equalOrMatch === 'match') {
			expect(fragment).to.containSubset(j)
		} else {
			expect(fragment).to.deep.equal(j)
		}
		return result
	}),
	regexMatcher(/^"([^"]+)" of the GQL response should be (true|false)$/)(
		async ([exp, expected], _, runner) => {
			const { appSyncClient: client } = runner.store
			const e = jsonata(exp)
			const v = e.evaluate(client.response)
			expect(v).to.equal(expected === 'true')
			return v
		},
	),
	regexMatcher(/^"([^"]+)" of the GQL response should contain "([^"]+)"$/)(
		async ([exp, expected], _, runner) => {
			const { appSyncClient: client } = runner.store
			const e = jsonata(exp)
			const v = e.evaluate(client.response)
			expect(v).to.contain(expected)
			return v
		},
	),
	regexMatcher(/^I store "([^"]+)" of the GQL response as "([^"]+)"$/)(
		async ([expression, storeName], _, runner) => {
			const { appSyncClient: client } = runner.store
			expect(client.response).to.have.property('data')
			expect(client.response.data).to.have.property(client.selection)
			const e = jsonata(expression)
			const result = e.evaluate(client.response)
			expect(result).to.not.be.an('undefined')
			runner.store[storeName] = result
			return result
		},
	),
	regexMatcher(
		/^I store (?:"([^"]+)" of )?the GQL operation result as "([^"]+)"$/,
	)(async ([expression, storeName], _, runner) => {
		const { appSyncClient: client } = runner.store
		let result = client.response.data[client.selection]
		if (expression) {
			const e = jsonata(expression)
			result = e.evaluate(result)
		}
		expect(result).to.not.be.an('undefined')
		runner.store[storeName] = result
		return result
	}),
	// This simplifies the check by only looking at the selection supplied in the request
	regexMatcher(
		/^(?:"([^"]+)" of )?the GQL operation result (parsed as JSON )?should (equal|match) this JSON$/,
	)(async ([exp, parseAsJson, equalOrMatch], step, runner) => {
		const { appSyncClient: client } = runner.store
		expect(client.response).to.have.property('data')
		expect(client.response.data).to.have.property(client.selection)
		if (step.interpolatedArgument === undefined) {
			throw new Error('Must provide argument!')
		}
		const j = JSON.parse(step.interpolatedArgument)
		const opResult = client.response.data[client.selection]
		let fragment = exp ? jsonata(exp).evaluate(opResult) : opResult
		if (parseAsJson) {
			fragment = JSON.parse(fragment)
		}
		if (equalOrMatch === 'match') {
			expect(fragment).to.containSubset(j)
		} else {
			expect(fragment).to.deep.equal(j)
		}
		return opResult
	}),
	regexMatcher(
		/^(?:"([^"]+)" of )?the GQL operation result should (?:(not) )?equal "([^"]+)"$/,
	)(async ([exp, not, expected], _, runner) => {
		const { appSyncClient: client } = runner.store
		expect(client.response).to.have.property('data')
		expect(client.response.data).to.have.property(client.selection)
		const opResult = client.response.data[client.selection]
		const fragment = exp ? jsonata(exp).evaluate(opResult) : opResult
		if (not) {
			expect(fragment).to.not.equal(expected)
		} else {
			expect(fragment).to.equal(expected)
		}
		return opResult
	}),
	regexMatcher(
		/^"([^"]+)" of the GQL operation result should be (true|false|null|undefined)$/,
	)(async ([exp, expected], _, runner) => {
		const { appSyncClient: client } = runner.store
		expect(client.response).to.have.property('data')
		expect(client.response.data).to.have.property(client.selection)
		const opResult = client.response.data[client.selection]
		const checks: { [key: string]: (fragment: any) => any } = {
			null: (fragment) => expect(fragment).to.equal(null),
			undefined: (fragment) => expect(fragment).to.equal(undefined),
			true: (fragment) => expect(fragment).to.equal(true),
			false: (fragment) => expect(fragment).to.equal(false),
		}
		checks[expected](jsonata(exp).evaluate(opResult))
		return opResult
	}),
	regexMatcher(/^the GQL queries are authenticated with Cognito$/)(
		async (_, __, runner) => {
			const { appSyncClient: client } = runner.store
			client.authorization = 'IAM'
		},
	),
	regexMatcher(
		/^the GQL queries are authenticated with the API key "([^"]+)"$/,
	)(async ([apiKey], __, runner) => {
		const { appSyncClient: client } = runner.store
		client.authorization = 'API_KEY'
		client.apiKey = apiKey
	}),
	regexMatcher(/^I set the GQL variable "([^"]+)" to "([^"]+)"$/)(
		async ([name, value], _, runner) => {
			const { appSyncClient: client } = runner.store
			client.variables[name] = value
		},
	),
	regexMatcher(
		/^I set the GQL variable "([^"]+)" to (the stringified version of )?this JSON$/,
	)(async ([name, stringify], step, runner) => {
		const { appSyncClient: client } = runner.store
		if (step.interpolatedArgument === undefined) {
			throw new Error('Must provide argument!')
		}
		const j = JSON.parse(step.interpolatedArgument)
		client.variables[name] = stringify ? JSON.stringify(j) : j
		return client.variables[name]
	}),
	// Subscriptions
	regexMatcher(
		/^I am subscribed to the "([^"]+)" GQL subscription(?: as "([^"]+)")?( with these variables)?$/,
	)(async ([subscriptionId, userId, withVariables], step, runner) => {
		const { appSyncClient: client } = runner.store
		let key = subscriptionId
		if (userId) {
			key = `${key}:${userId}`
		}
		let variables
		if (withVariables) {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			variables = JSON.parse(step.interpolatedArgument)
		}

		const query = getQuery(runner.store, client, userId)

		client.subscriptions[key] = await subscribe(
			runner,
			client.subscriptionQueries[subscriptionId],
			query,
			variables,
		)
	}),
	regexMatcher(
		/^I register a "([^"]+)" listener on the "([^"]+)" GQL subscription(?: as "([^"]+)")?( that matches this JSON)?$/,
	)(async ([listener, subscriptionId, userId, matchJSON], step, runner) => {
		const { appSyncClient: client } = runner.store
		if (client.listenerSubscription[listener] !== undefined) {
			console.warn(`The listener "${listener}" is already registered!`)
		}
		let key = subscriptionId
		if (userId) {
			key = `${key}:${userId}`
		}
		if (client.subscriptions[key] === undefined) {
			throw new Error(`Subscription "${key}" not found!`)
		}
		let matcher = {}
		if (matchJSON) {
			if (step.interpolatedArgument === undefined) {
				throw new Error('Must provide argument!')
			}
			matcher = JSON.parse(step.interpolatedArgument)
		}

		client.subscriptions[key].addListener(listener, matcher)
		client.listenerSubscription[listener] = client.subscriptions[key]
	}),
	regexMatcher(
		/^I should receive a message on the "([^"]+)" GQL subscription listener?$/,
	)(async ([listener], _, runner) => {
		const { appSyncClient: client } = runner.store
		if (client.listenerSubscription[listener] === undefined) {
			throw new Error(`Listener "${listener}" not found!`)
		}
		return client.listenerSubscription[listener].listenerMessage(listener)
	}),
	regexMatcher(
		/^"([^"]+)" of the last "([^"]+)" GQL subscription listener message should equal "([^"]+)"$/,
	)(async ([exp, subscriptionId, expected], _, runner) => {
		const { appSyncClient: client } = runner.store
		const message =
			client.subscriptionMessages[subscriptionId][
				client.subscriptionMessages[subscriptionId].length - 1
			]
		expect(jsonata(exp).evaluate(message)).to.equal(expected)
	}),
]
