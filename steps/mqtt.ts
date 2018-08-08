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
  mqttMessages: { [key: string]: object[] } = {};
  lastMqttMessage: object = {};

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
    this.client.on('message', (topic: string, payload: any) => {
      if (!this.mqttMessages[topic]) {
        this.mqttMessages[topic] = [];
      }
      const m = JSON.parse(payload.toString());
      this.mqttMessages[topic].push(m);
      this.lastMqttMessage = m;
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
        runner.cleanup(() =>
          c.removeThing(thing.credentials, runner.world.testThingPolicy),
        );
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
    willRun: regexMatcher(/^I should receive a message on the topic ([^ ]+)$/),
    run: async ([topic], _, runner) =>
      new Promise(resolve => {
        thing.client.subscribe(topic);
        thing.client.on('message', (topic, message) => {
          runner.progress(`MQTT < ${topic}`, message.toString());
          if (topic !== topic) {
            return;
          }
          thing.client.unsubscribe(topic);
          resolve(JSON.parse(message.toString()));
        });
      }),
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
