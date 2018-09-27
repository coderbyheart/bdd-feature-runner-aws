import { FeatureRunner } from './runner';
import { ElivagarWorld } from '../run-features';
import { Iot, IotData } from 'aws-sdk';

const iot = new Iot();
export type ThingCredentials = {
  privateKey: string;
  publicKey: string;
  certificate: string;
  clientId: string;
  brokerHostname: string;
  certificateArn: string;
};

export class ThingHelper {
  async createTestThing(
    runner: FeatureRunner<ElivagarWorld>,
  ): Promise<ThingCredentials> {
    const thingName = `${runner.world.Stage}-${Math.random()
      .toString(36)
      .replace(/[^a-z]+/g, '')}`;
    await iot
      .createThing({
        thingName,
        attributePayload: {
          attributes: {
            tenantId: runner.world.tenantId,
            stage: runner.world.Stage,
          },
        },
      })
      .promise();
    const {
      certificateArn,
      certificatePem,
      keyPair,
    } = await iot.createKeysAndCertificate({ setAsActive: true }).promise();
    if (!certificateArn || !keyPair || !certificatePem) {
      throw new Error('Failed to create certificate.');
    }
    const { PrivateKey, PublicKey } = keyPair;
    if (!PrivateKey || !PublicKey) {
      throw new Error('Failed to create key pair.');
    }
    await iot
      .attachThingPrincipal({ principal: certificateArn, thingName })
      .promise();
    await iot
      .addThingToThingGroup({
        thingName,
        thingGroupName: runner.world.TestThingGroup,
      })
      .promise();
    const iotData = new IotData({
      endpoint: runner.world.iotEndpoint,
    });
    await iotData
      .updateThingShadow({
        payload: JSON.stringify({
          state: {
            reported: {
              elivagar: 1,
            },
          },
        }),
        thingName,
      })
      .promise();
    return {
      privateKey: PrivateKey,
      publicKey: PublicKey,
      certificateArn,
      certificate: certificatePem,
      clientId: thingName,
      brokerHostname: runner.world.iotEndpoint,
    };
  }
}
