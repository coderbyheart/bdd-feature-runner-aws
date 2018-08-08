import { ThingCredentials } from './thing-helper';
import { device } from 'aws-iot-device-sdk';

export class TestThing {
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
