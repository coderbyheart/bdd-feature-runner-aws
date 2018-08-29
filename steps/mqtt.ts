import * as jsonata from 'jsonata';
import { StepRunner } from '../lib/runner';
import { regexMatcher } from '../lib/regexMatcher';
import { device } from 'aws-iot-device-sdk';
import { expect } from 'chai';
import { ElivagarWorld } from '../run-features';
import { ThingCredentials, ThingHelper } from '../lib/thing-helper';

const c = new ThingHelper();

class TestThing {
  credentials: ThingCredentials;
  client: device;
  lastMqttMessage: object = {};
  subscription?: Promise<object>;
  cancelSubscription?: () => void;

  constructor(credentials: ThingCredentials) {
    this.credentials = credentials;
    const { privateKey, certificate, clientId, brokerHostname } = credentials;

    this.client = new device({
      host: brokerHostname,
      privateKey: Buffer.from(privateKey, 'utf8'),
      clientCert: Buffer.from(certificate, 'utf8'),
      caPath: './features/data/ca.cert',
      clientId,
    });
  }

  async connect() {
    return new Promise(resolve => {
      this.client.on('connect', () => {
        resolve();
      });
    });
  }

  async disconnect() {
    return new Promise(resolve => this.client.end(false, resolve));
  }
}

let thing: TestThing;

export const runners: StepRunner<ElivagarWorld>[] = [
  {
    willRun: regexMatcher(/^I have a Test Device/),
    run: async (_, __, runner) => {
      if (!thing) {
        thing = new TestThing(await c.createTestThing(runner));
        runner.store.clientId = thing.credentials.clientId;
        await thing.connect();
        runner.cleanup(() => thing.disconnect());
      }
      return thing.credentials.clientId;
    },
  },
  {
    willRun: regexMatcher(
      /^my Test Device publishes this message on the topic ([^ ]+)$/,
    ),
    run: async ([topic], step, runner) => {
      if (!step.interpolatedArgument) throw new Error('Must provide argument!');
      thing.client.publish(topic, step.interpolatedArgument);
      runner.progress(`MQTT > ${topic}`, step.interpolatedArgument);
      return JSON.parse(step.interpolatedArgument);
    },
  },
  {
    willRun: regexMatcher(/^I am subscribed to the topic ([^ ]+)$/),
    run: async ([topic], _, runner) => {
      if (thing.cancelSubscription) {
        thing.cancelSubscription();
      }
      thing.client.subscribe(topic);
      thing.subscription = new Promise((resolve, reject) => {
        const handle = setTimeout(() => reject(new Error('Timeout!')), 10000);
        thing.client.subscribe(topic);
        thing.client.on('message', (t: string, payload: any) => {
          runner.progress(`MQTT < ${t}`, payload.toString());
          thing.client.unsubscribe(topic);
          if (t !== topic) {
            reject(new Error(`Unexpected topic: ${t}!`));
          }
          resolve(JSON.parse(payload.toString()));
        });
        thing.cancelSubscription = () => {
          clearTimeout(handle);
          thing.client.unsubscribe(topic);
        };
      });
    },
  },
  {
    willRun: regexMatcher(/^I should receive a message$/),
    run: async () => {
      if (!thing.subscription) throw new Error('Not subscribed!');
      thing.lastMqttMessage = await thing.subscription;
    },
  },
  {
    willRun: regexMatcher(
      /^"([^"]+)" of the last message should equal this JSON$/,
    ),
    run: async ([exp], step) => {
      if (!step.interpolatedArgument) throw new Error('Must provide argument!');
      const j = JSON.parse(step.interpolatedArgument);
      const e = jsonata(exp);
      const result = e.evaluate(thing.lastMqttMessage);
      expect(result).to.deep.equal(j);
      return result;
    },
  },
  {
    willRun: regexMatcher(
      /^"([^"]+)" of the last message should equal "([^"]+)"$/,
    ),
    run: async ([exp, expected]) => {
      const e = jsonata(exp);
      const result = e.evaluate(thing.lastMqttMessage);
      expect(result).to.deep.equal(expected);
    },
  },
];
