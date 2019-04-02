import { GQLSubscription } from './GQLSubscription';

export type AppSyncClient = {
  endpoint: string;
  operation: string;
  selection: string;
  response: { [key: string]: any };
  variables: { [key: string]: string };
  authorization: 'IAM' | 'API_KEY';
  apiKey?: string;
  subscriptions: { [key: string]: GQLSubscription };
  subscriptionQueries: { [key: string]: string };
  listenerSubscription: {
    [key: string]: GQLSubscription;
  };
  subscriptionMessages: { [key: string]: any[] };
};

export const AppSyncClient = (): AppSyncClient => ({
  endpoint: '',
  operation: '',
  selection: '',
  response: {},
  variables: {},
  authorization: 'IAM',
  subscriptions: {},
  subscriptionQueries: {},
  listenerSubscription: {},
  subscriptionMessages: {},
});
