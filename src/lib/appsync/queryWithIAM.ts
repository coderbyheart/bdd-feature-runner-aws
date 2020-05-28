import * as AWS from 'aws-sdk'
import { Credentials, Endpoint, HttpRequest } from 'aws-sdk'
import fetch from 'node-fetch'
import { parse } from 'url'
import { parseQuery } from './parseQuery'
import { GQLQueryResult } from '../gql-query-result'

export const queryWithIAM = (
	AccessKeyId: string,
	SecretKey: string,
	SessionToken: string,
	endpoint: string,
) => async (
	gqlQuery: string,
	variables?: { [key: string]: string },
): Promise<GQLQueryResult> => {
	const credentials = new Credentials(AccessKeyId, SecretKey, SessionToken)
	const { selection, operation } = parseQuery(gqlQuery)
	const graphQLEndpoint = parse(endpoint)
	const region = graphQLEndpoint.host!.split('.')[2]
	const httpRequest = new HttpRequest(new Endpoint(endpoint), region)
	const query = {
		query: gqlQuery,
		variables,
	}

	httpRequest.headers.host = graphQLEndpoint.host!
	httpRequest.headers['Content-Type'] = 'application/json'
	httpRequest.method = 'POST'
	// @ts-ignore Signers is not a public API
	httpRequest.region = region
	httpRequest.body = JSON.stringify(query)

	// @ts-ignore Signers is not a public API
	const signer = new AWS.Signers.V4(httpRequest, 'appsync', true)
	// @ts-ignore AWS.util is not a public API
	signer.addAuthorization(credentials, new Date())

	const options = {
		method: httpRequest.method,
		body: httpRequest.body,
		headers: httpRequest.headers,
	}

	const response = await fetch(graphQLEndpoint.href, options)
	return {
		operation,
		selection,
		result: await response.json(),
	}
}
