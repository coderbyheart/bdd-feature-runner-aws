import { FeatureRunner } from '../runner';
import { AppSyncClient } from './appSyncClient';
import { query } from './query';
import { GQLSubscription } from './GQLSubscription';

export const subscribe = async (
  client: AppSyncClient,
  runner: FeatureRunner<any>,
  subscription: string,
  userId: string,
  variables?: { [key: string]: string },
) => {
  const prefix = userId ? `cognito:${userId}` : `cognito`;
  const {
    [`${prefix}:AccessKeyId`]: AccessKeyId,
    [`${prefix}:SecretKey`]: SecretKey,
    [`${prefix}:SessionToken`]: SessionToken,
  } = runner.store;
  const q = subscription.replace(/\n\s*/g, ' ');
  await runner.progress('GQL@', `${q}`);
  if (variables) {
    await runner.progress('GQL@', JSON.stringify(variables));
  }

  const { selection, result } = await query(
    AccessKeyId,
    SecretKey,
    SessionToken,
    client.endpoint,
    q,
    variables,
  );

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
