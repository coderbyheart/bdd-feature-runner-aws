import { FeatureRunner } from './runner';
import { ElivagarWorld } from '../run-features';
import { Iot, IotData } from 'aws-sdk';
import { v4 } from 'uuid';

const iot = new Iot();
export type Gateway = {
  thingName: string;
};

/**
 * Creates fake Gateway devices for testing BLE features.
 */
export class GatewayHelper {
  async createTestGateway(
    runner: FeatureRunner<ElivagarWorld>,
  ): Promise<Gateway> {
    const thingName = v4();

    // BLE Gateways have a specific ThingType
    const thingTypeName = 'gateway_nordicsemi_ble_generic_generic_1-1';
    try {
      await iot
        .describeThingType({
          thingTypeName,
        })
        .promise();
    } catch {
      await iot
        .createThingType({
          thingTypeName,
          thingTypeProperties: {
            searchableAttributes: ['stage', 'tenantId'],
          },
        })
        .promise();
    }

    await iot
      .createThing({
        thingName,
        thingTypeName,
        attributePayload: {
          attributes: {
            tenantId: runner.world.tenantUUID, // tenantId is IRIS legacy name
            stage: runner.world.IrisPrefix,
          },
        },
      })
      .promise();
    await iot
      .addThingToThingGroup({
        thingName,
        thingGroupName: runner.world.TestThingGroup,
      })
      .promise();
    return {
      thingName,
    };
  }

  /**
   * Adds a device to the shadow of a gateway and marks this device as connected
   */
  async addDevice(
    runner: FeatureRunner<ElivagarWorld>,
    thingName: string,
    deviceId: string,
  ): Promise<void> {
    const iotData = new IotData({
      endpoint: runner.world.iotEndpoint,
    });
    await iotData
      .updateThingShadow({
        payload: JSON.stringify({
          state: {
            reported: {
              connected: true,
              statusConnections: {
                [deviceId]: {
                  id: deviceId,
                  status: {
                    connected: true,
                    connectTimeOut: false,
                  },
                },
              },
            },
            desired: {
              desiredConnections: [
                {
                  id: deviceId,
                },
              ],
            },
          },
        }),
        thingName,
      })
      .promise();
  }
}
