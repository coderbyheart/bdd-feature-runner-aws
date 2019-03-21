import {
  StepRunner,
  Store,
  FeatureRunner,
  StepRunnerFunc,
} from '../lib/runner';
import { regexMatcher } from '../lib/regexMatcher';
import * as chai from 'chai';
import { expect } from 'chai';
import * as jsonata from 'jsonata';
import { AppSyncClient } from '../lib/appsync/appSyncClient';
import { query } from '../lib/appsync/query';
import { subscribe } from '../lib/appsync/subscribe';

const chaiSubset = require('chai-subset');

chai.use(chaiSubset);

export const appSyncBeforeAll = async (
  runner: FeatureRunner<Store>,
): Promise<AppSyncClient> => {
  runner.store.appSyncClient = AppSyncClient();
  return runner.store.appSyncClient;
};

export const appSyncAfterAll = async (runner: FeatureRunner<Store>) => {
  Object.keys(runner.store.appSyncClient.subscriptions).forEach(id =>
    runner.store.appSyncClient.subscriptions[id].disconnect(),
  );
};

export type AppSyncStepRunnerStore = Store & {
  appSyncClient: AppSyncClient;
};

/**
 * BDD steps for interacting with an AWS Appsync GQL API
 */
export const appSyncStepRunners = <
  W extends AppSyncStepRunnerStore
>(): StepRunner<W>[] => {
  const s = (rx: RegExp, run: StepRunnerFunc<W>): StepRunner<W> => ({
    willRun: regexMatcher(rx),
    run,
  });
  return [
    s(/^the GQL endpoint is "([^"]+)"$/, async ([endpoint], _, runner) => {
      const { appSyncClient: client } = runner.store;
      client.endpoint = endpoint;
    }),
    s(
      /^I execute this GQL query(?: as "([^"]+)")?$/,
      async ([userId], step, runner) => {
        const { appSyncClient: client } = runner.store;
        if (!step.interpolatedArgument) {
          throw new Error('Must provide argument!');
        }
        const prefix = userId ? `cognito:${userId}` : `cognito`;
        const {
          [`${prefix}:AccessKeyId`]: AccessKeyId,
          [`${prefix}:SecretKey`]: SecretKey,
          [`${prefix}:SessionToken`]: SessionToken,
        } = runner.store;
        const q = step.interpolatedArgument.replace(/\n\s*/g, ' ');
        await runner.progress('GQL>', q);
        const { result, operation, selection } = await query(
          AccessKeyId,
          SecretKey,
          SessionToken,
          client.endpoint,
          q,
          client.variables,
        );
        client.variables = {};
        client.response = result;
        client.operation = operation;
        client.selection = selection;
        await runner.progress('<GQL', JSON.stringify(result));
        return [q, result];
      },
    ),
    s(
      /^the GQL query result should not contain errors$/,
      async (_, __, runner) => {
        const { appSyncClient: client } = runner.store;
        expect(client.response).to.not.have.property('errors');
      },
    ),
    s(
      /^the GQL query result should contain this error$/,
      async (_, step, runner) => {
        const { appSyncClient: client } = runner.store;
        if (!step.interpolatedArgument) {
          throw new Error('Must provide argument!');
        }
        expect(client.response).to.have.property('errors');
        expect(client.response.errors).to.containSubset([
          JSON.parse(step.interpolatedArgument),
        ]);
      },
    ),
    // This checks the entire response
    s(
      /^(?:"([^"]+)" of )?the GQL response should (equal|match) this JSON$/,
      async ([exp, equalOrMatch], step, runner) => {
        const { appSyncClient: client } = runner.store;
        if (!step.interpolatedArgument) {
          throw new Error('Must provide argument!');
        }
        const j = JSON.parse(step.interpolatedArgument);
        const result = client.response;
        const fragment = exp ? jsonata(exp).evaluate(result) : result;
        if (equalOrMatch === 'match') {
          expect(fragment).to.containSubset(j);
        } else {
          expect(fragment).to.deep.equal(j);
        }
        return result;
      },
    ),
    s(
      /^"([^"]+)" of the GQL response should be (true|false)$/,
      async ([exp, expected], _, runner) => {
        const { appSyncClient: client } = runner.store;
        const e = jsonata(exp);
        const v = e.evaluate(client.response);
        expect(v).to.equal(expected === 'true');
        return v;
      },
    ),
    s(
      /^"([^"]+)" of the GQL response should contain "([^"]+)"$/,
      async ([exp, expected], _, runner) => {
        const { appSyncClient: client } = runner.store;
        const e = jsonata(exp);
        const v = e.evaluate(client.response);
        expect(v).to.contain(expected);
        return v;
      },
    ),
    s(
      /^I store "([^"]+)" of the GQL response as "([^"]+)"$/,
      async ([expression, storeName], _, runner) => {
        const { appSyncClient: client } = runner.store;
        expect(client.response).to.have.property('data');
        expect(client.response.data).to.have.property(client.selection);
        const e = jsonata(expression);
        const result = e.evaluate(client.response);
        expect(result).to.not.be.an('undefined');
        runner.store[storeName] = result;
        return result;
      },
    ),
    s(
      /^I store (?:"([^"]+)" of )?the GQL operation result as "([^"]+)"$/,
      async ([expression, storeName], _, runner) => {
        const { appSyncClient: client } = runner.store;
        let result = client.response.data[client.selection];
        if (expression) {
          const e = jsonata(expression);
          result = e.evaluate(result);
        }
        expect(result).to.not.be.an('undefined');
        runner.store[storeName] = result;
        return result;
      },
    ),
    // This simplifies the check by only looking at the selection supplied in the request
    s(
      /^(?:"([^"]+)" of )?the GQL operation result (parsed as JSON )?should (equal|match) this JSON$/,
      async ([exp, parseAsJson, equalOrMatch], step, runner) => {
        const { appSyncClient: client } = runner.store;
        expect(client.response).to.have.property('data');
        expect(client.response.data).to.have.property(client.selection);
        if (!step.interpolatedArgument) {
          throw new Error('Must provide argument!');
        }
        const j = JSON.parse(step.interpolatedArgument);
        const opResult = client.response.data[client.selection];
        let fragment = exp ? jsonata(exp).evaluate(opResult) : opResult;
        if (parseAsJson) {
          fragment = JSON.parse(fragment);
        }
        if (equalOrMatch === 'match') {
          expect(fragment).to.containSubset(j);
        } else {
          expect(fragment).to.deep.equal(j);
        }
        return opResult;
      },
    ),
    s(
      /^(?:"([^"]+)" of )?the GQL operation result should (?:(not) )?equal "([^"]+)"$/,
      async ([exp, not, expected], _, runner) => {
        const { appSyncClient: client } = runner.store;
        expect(client.response).to.have.property('data');
        expect(client.response.data).to.have.property(client.selection);
        const opResult = client.response.data[client.selection];
        const fragment = exp ? jsonata(exp).evaluate(opResult) : opResult;
        if (not) {
          expect(fragment).to.not.equal(expected);
        } else {
          expect(fragment).to.equal(expected);
        }
        return opResult;
      },
    ),
    s(
      /^"([^"]+)" of the GQL operation result should be (true|false|null|undefined)$/,
      async ([exp, expected], _, runner) => {
        const { appSyncClient: client } = runner.store;
        expect(client.response).to.have.property('data');
        expect(client.response.data).to.have.property(client.selection);
        const opResult = client.response.data[client.selection];
        const checks: { [key: string]: (fragment: any) => any } = {
          null: fragment => expect(fragment).to.equal(null),
          undefined: fragment => expect(fragment).to.equal(undefined),
          true: fragment => expect(fragment).to.equal(true),
          false: fragment => expect(fragment).to.equal(false),
        };
        checks[expected](jsonata(exp).evaluate(opResult));
        return opResult;
      },
    ),
    s(
      /^I set the GQL variable "([^"]+)" to "([^"]+)"$/,
      async ([name, value], _, runner) => {
        const { appSyncClient: client } = runner.store;
        client.variables[name] = value;
      },
    ),
    s(
      /^I set the GQL variable "([^"]+)" to (the stringified version of )?this JSON$/,
      async ([name, stringify], step, runner) => {
        const { appSyncClient: client } = runner.store;
        if (!step.interpolatedArgument) {
          throw new Error('Must provide argument!');
        }
        const j = JSON.parse(step.interpolatedArgument);
        client.variables[name] = stringify ? JSON.stringify(j) : j;
        return client.variables[name];
      },
    ),
    // Subscriptions
    s(
      /^I am subscribed to the "([^"]+)" GQL subscription(?: as "([^"]+)")?( with these variables)?$/,
      async ([subscriptionId, userId, withVariables], step, runner) => {
        const { appSyncClient: client } = runner.store;
        let key = subscriptionId;
        if (userId) {
          key = `${key}:${userId}`;
        }
        let variables;
        if (withVariables) {
          if (!step.interpolatedArgument) {
            throw new Error('Must provide argument!');
          }
          variables = JSON.parse(step.interpolatedArgument);
        }
        if (!client.subscriptions[key]) {
          client.subscriptions[key] = await subscribe(
            client,
            runner,
            client.subscriptionQueries[subscriptionId],
            userId,
            variables,
          );
        }
      },
    ),
    s(
      /^I register a "([^"]+)" listener on the "([^"]+)" GQL subscription(?: as "([^"]+)")?( that matches this JSON)?$/,
      async ([listener, subscriptionId, userId, matchJSON], step, runner) => {
        const { appSyncClient: client } = runner.store;
        if (client.listenerSubscription[listener]) {
          console.warn(`The listener "${listener}" is already registered!`);
        }
        let key = subscriptionId;
        if (userId) {
          key = `${key}:${userId}`;
        }
        if (!client.subscriptions[key]) {
          throw new Error(`Subscription "${key}" not found!`);
        }
        let matcher = {};
        if (matchJSON) {
          if (!step.interpolatedArgument) {
            throw new Error('Must provide argument!');
          }
          matcher = JSON.parse(step.interpolatedArgument);
        }

        client.subscriptions[key].addListener(listener, matcher);
        client.listenerSubscription[listener] = client.subscriptions[key];
      },
    ),
    s(
      /^I should receive a message on the "([^"]+)" GQL subscription listener?$/,
      async ([listener], _, runner) => {
        const { appSyncClient: client } = runner.store;
        if (!client.listenerSubscription[listener]) {
          throw new Error(`Listener "${listener}" not found!`);
        }
        return client.listenerSubscription[listener].listenerMessage(listener);
      },
    ),
    s(
      /^"([^"]+)" of the last "([^"]+)" GQL subscription listener message should equal "([^"]+)"$/,
      async ([exp, subscriptionId, expected], _, runner) => {
        const { appSyncClient: client } = runner.store;
        const message =
          client.subscriptionMessages[subscriptionId][
            client.subscriptionMessages[subscriptionId].length - 1
          ];
        expect(jsonata(exp).evaluate(message)).to.equal(expected);
      },
    ),
  ];
};
