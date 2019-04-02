import { FeatureRunner } from '../runner';
import { GQLSubscription } from './GQLSubscription';

export const subscribe = async (
  runner: FeatureRunner<any>,
  subscription: string,
  query: (
    gqlQuery: string,
    variables?: { [key: string]: string },
  ) => Promise<{
    operation: string;
    selection: string;
    result: any;
  }>,
  variables?: { [key: string]: string },
) => {
  const q = subscription.replace(/\n\s*/g, ' ');
  await runner.progress('GQL@', `${q}`);
  if (variables) {
    await runner.progress('GQL@', JSON.stringify(variables));
  }

  const { selection, result } = await query(q, variables);

  const {
    data,
    extensions: {
      subscription: { mqttConnections },
    },
  } = result;
  await runner.progress('<GQL', JSON.stringify(data));
  const { url, client: clientId, topics } = mqttConnections[0];

  return new GQLSubscription(selection, url, clientId, topics, runner);
};
