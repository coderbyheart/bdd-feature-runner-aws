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
    const thingName = `${runner.world.stage}-${Math.random()
      .toString(36)
      .replace(/[^a-z]+/g, '')}`;
    await iot
      .createThing({
        thingName,
        attributePayload: {
          attributes: {
            tenantUUID: runner.world.tenantUUID,
            stage: runner.world.stage,
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
      .attachPrincipalPolicy({
        policyName: runner.world.testThingPolicy,
        principal: certificateArn,
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

  async removeThing(thing: ThingCredentials, policyName: string): Promise<any> {
    const { clientId: thingName } = thing;

    await iot
      .detachPrincipalPolicy({
        policyName,
        principal: thing.certificateArn,
      })
      .promise();

    await iot
      .detachThingPrincipal({
        thingName,
        principal: thing.certificateArn,
      })
      .promise();

    const certificateId = thing.certificateArn.split('/')[1];
    await iot
      .updateCertificate({
        certificateId,
        newStatus: 'INACTIVE',
      })
      .promise();

    // Give time to detach
    await new Promise(resolve => {
      setTimeout(resolve, 1000);
    });

    await iot.deleteCertificate({ certificateId }).promise();

    await iot.deleteThing({ thingName }).promise();

    return `Thing ${thingName} deleted.`;
  }
}
