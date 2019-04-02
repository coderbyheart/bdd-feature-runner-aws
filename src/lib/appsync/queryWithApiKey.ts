import fetch from 'node-fetch';
import { parse } from 'url';
import { parseQuery } from './parseQuery';

export const queryWithApiKey = (apiKey: string, endpoint: string) => async (
  gqlQuery: string,
  variables?: { [key: string]: string },
) => {
  const { selection, operation } = parseQuery(gqlQuery);

  const query = {
    query: gqlQuery,
    variables,
  };

  const graphQLEndpoint = parse(endpoint);

  const options = {
    method: 'POST',
    body: JSON.stringify(query),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
  };

  const response = await fetch(graphQLEndpoint.href!, options);
  return {
    operation,
    selection,
    result: await response.json(),
  };
};
