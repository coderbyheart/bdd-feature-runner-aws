import * as AWS from 'aws-sdk';
import { Credentials, Endpoint, HttpRequest } from 'aws-sdk';
import fetch from 'node-fetch';
import { parse } from 'url';
import { FieldNode, getOperationAST, parse as gqlParse } from 'graphql';

export const query = async (
  AccessKeyId: string,
  SecretKey: string,
  SessionToken: string,
  endpoint: string,
  gqlQuery: string,
  variables?: { [key: string]: string },
) => {
  const credentials = new Credentials(AccessKeyId, SecretKey, SessionToken);
  let selection = '';
  let operation = '';

  try {
    const op = getOperationAST(gqlParse(gqlQuery), undefined);
    operation = op && op.name ? op.name.value : '';
    selection =
      (op &&
        op.selectionSet.selections.length &&
        (<FieldNode>op.selectionSet.selections[0]).name.value) ||
      '';
  } catch (error) {
    throw new TypeError(`Invalid GQL query: ${gqlQuery}: "${error.message}"`);
  }

  const query = {
    query: gqlQuery,
    variables,
  };

  const graphQLEndpoint = parse(endpoint);
  const region = graphQLEndpoint.host!.split('.')[2];
  const httpRequest = new HttpRequest(new Endpoint(endpoint), region);

  httpRequest.headers.host = graphQLEndpoint.host!;
  httpRequest.headers['Content-Type'] = 'application/json';
  httpRequest.method = 'POST';
  // @ts-ignore Signers is not a public API
  httpRequest.region = region;
  httpRequest.body = JSON.stringify(query);

  // @ts-ignore Signers is not a public API
  const signer = new AWS.Signers.V4(httpRequest, 'appsync', true);
  // @ts-ignore AWS.util is not a public API
  signer.addAuthorization(credentials, new Date());

  const options = {
    method: httpRequest.method,
    body: httpRequest.body,
    headers: httpRequest.headers,
  };

  const response = await fetch(graphQLEndpoint.href!, options);
  return {
    operation,
    selection,
    result: await response.json(),
  };
};
