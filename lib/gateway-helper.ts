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
    const iotData = new IotData({
      endpoint: runner.world.iotEndpoint,
    });

    // BLE Gateways have a specific ThingType
    const thingTypeName = process.env.IOT_GATEWAY_GROUP || 'gateway_nordicsemi_ble_generic_generic_1-1';
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
    await iotData
      .publish({ 
        topic: `${runner.world.IrisPrefix}/${runner.world.tenantUUID}/admin/c2a`, 
        payload: JSON.stringify({
          type: "event",
          event: {
            timestamp: Date.now(),
            type: "gateway",
            gatewayId: thingName,
            subType: "added"
          }
        })}).promise();
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
    await iotData
      .publish({ 
        topic: `${runner.world.IrisPrefix}/${runner.world.tenantUUID}/gateways/${thingName}/c2a`, 
        payload: JSON.stringify({
          "requestId": "N/A",
          "type": "event",
          "gatewayId": "ba11beab-6fb1-4977-8bfc-2728849b0656",
          "event": {
            "type": "device_discover_result",
            "timestamp": "2018-09-13T21:41:33.937Z",
            "device": {
              "id": "CA:B2:31:EE:E0:9E",
              "address": {
                "address": "CA:B2:31:EE:E0:9E",
                "type": "randomStatic"
              },
              "connectOptions": {
                "security": {
                  "initiate": true
                }
              },
              "statistics": {
                "addedAt": "2018-09-13T21:41:30.105Z",
                "lastConnect": "2018-09-13T21:41:30.114Z",
                "connectCount": 2,
                "disconnectCount": 0
              },
              "status": {
                "connected": true,
                "connecting": false,
                "connectTimedOut": false,
                "auth": {
                  "description": "pairingNotSupp",
                  "statusCode": 133,
                  "source": "remote",
                  "bonded": false
                }
              }
            },
            "services": {
              "1800": {
                "uuid": "1800",
                "characteristics": {
                  "2A00": {
                    "uuid": "2A00",
                    "path": "1800/2A00",
                    "value": [
                      70,
                      53,
                      58,
                      57,
                      67
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "2A01": {
                    "uuid": "2A01",
                    "path": "1800/2A01",
                    "value": [
                      0,
                      0
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "2A04": {
                    "uuid": "2A04",
                    "path": "1800/2A04",
                    "value": [
                      6,
                      0,
                      24,
                      0,
                      0,
                      0,
                      64,
                      1
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "2AA6": {
                    "uuid": "2AA6",
                    "path": "1800/2AA6",
                    "value": [
                      1
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  }
                }
              },
              "1801": {
                "uuid": "1801",
                "characteristics": {
                  "2A05": {
                    "uuid": "2A05",
                    "path": "1801/2A05",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": true,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "1801/2A05/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  }
                }
              },
              "EF6801009B3549339B1052FFA9740042": {
                "uuid": "EF6801009B3549339B1052FFA9740042",
                "characteristics": {
                  "EF6801019B3549339B1052FFA9740042": {
                    "uuid": "EF6801019B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801019B3549339B1052FFA9740042",
                    "value": [
                      70,
                      53,
                      58,
                      57,
                      67
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801029B3549339B1052FFA9740042": {
                    "uuid": "EF6801029B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801029B3549339B1052FFA9740042",
                    "value": [
                      96,
                      2,
                      180
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801049B3549339B1052FFA9740042": {
                    "uuid": "EF6801049B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801049B3549339B1052FFA9740042",
                    "value": [
                      6,
                      0,
                      24,
                      0,
                      0,
                      0,
                      64,
                      1
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801059B3549339B1052FFA9740042": {
                    "uuid": "EF6801059B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801059B3549339B1052FFA9740042",
                    "value": [
                      3,
                      103,
                      111,
                      111,
                      46,
                      103,
                      108,
                      47,
                      112,
                      73,
                      87,
                      100,
                      105,
                      114
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801069B3549339B1052FFA9740042": {
                    "uuid": "EF6801069B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801069B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801079B3549339B1052FFA9740042": {
                    "uuid": "EF6801079B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801079B3549339B1052FFA9740042",
                    "value": [
                      2,
                      1,
                      0
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6801089B3549339B1052FFA9740042": {
                    "uuid": "EF6801089B3549339B1052FFA9740042",
                    "path": "EF6801009B3549339B1052FFA9740042/EF6801089B3549339B1052FFA9740042",
                    "value": [
                      0,
                      23,
                      0
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  }
                }
              },
              "EF6802009B3549339B1052FFA9740042": {
                "uuid": "EF6802009B3549339B1052FFA9740042",
                "characteristics": {
                  "EF6802019B3549339B1052FFA9740042": {
                    "uuid": "EF6802019B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802019B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6802009B3549339B1052FFA9740042/EF6802019B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6802029B3549339B1052FFA9740042": {
                    "uuid": "EF6802029B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802029B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6802009B3549339B1052FFA9740042/EF6802029B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6802039B3549339B1052FFA9740042": {
                    "uuid": "EF6802039B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802039B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6802009B3549339B1052FFA9740042/EF6802039B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6802049B3549339B1052FFA9740042": {
                    "uuid": "EF6802049B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802049B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6802009B3549339B1052FFA9740042/EF6802049B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6802059B3549339B1052FFA9740042": {
                    "uuid": "EF6802059B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802059B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6802009B3549339B1052FFA9740042/EF6802059B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6802069B3549339B1052FFA9740042": {
                    "uuid": "EF6802069B3549339B1052FFA9740042",
                    "path": "EF6802009B3549339B1052FFA9740042/EF6802069B3549339B1052FFA9740042",
                    "value": [
                      208,
                      7,
                      208,
                      7,
                      208,
                      7,
                      220,
                      5,
                      2,
                      103,
                      78,
                      29
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  }
                }
              },
              "EF6804009B3549339B1052FFA9740042": {
                "uuid": "EF6804009B3549339B1052FFA9740042",
                "characteristics": {
                  "EF6804019B3549339B1052FFA9740042": {
                    "uuid": "EF6804019B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804019B3549339B1052FFA9740042",
                    "value": [
                      232,
                      3,
                      244,
                      1,
                      244,
                      1,
                      10,
                      0,
                      1
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6804029B3549339B1052FFA9740042": {
                    "uuid": "EF6804029B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804029B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804029B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804039B3549339B1052FFA9740042": {
                    "uuid": "EF6804039B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804039B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804039B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804049B3549339B1052FFA9740042": {
                    "uuid": "EF6804049B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804049B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804049B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804059B3549339B1052FFA9740042": {
                    "uuid": "EF6804059B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804059B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804059B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804069B3549339B1052FFA9740042": {
                    "uuid": "EF6804069B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804069B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804069B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804079B3549339B1052FFA9740042": {
                    "uuid": "EF6804079B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804079B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804079B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804089B3549339B1052FFA9740042": {
                    "uuid": "EF6804089B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804089B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804089B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6804099B3549339B1052FFA9740042": {
                    "uuid": "EF6804099B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF6804099B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF6804099B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF68040A9B3549339B1052FFA9740042": {
                    "uuid": "EF68040A9B3549339B1052FFA9740042",
                    "path": "EF6804009B3549339B1052FFA9740042/EF68040A9B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6804009B3549339B1052FFA9740042/EF68040A9B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  }
                }
              },
              "EF6803009B3549339B1052FFA9740042": {
                "uuid": "EF6803009B3549339B1052FFA9740042",
                "characteristics": {
                  "EF6803029B3549339B1052FFA9740042": {
                    "uuid": "EF6803029B3549339B1052FFA9740042",
                    "path": "EF6803009B3549339B1052FFA9740042/EF6803029B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6803009B3549339B1052FFA9740042/EF6803029B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6803019B3549339B1052FFA9740042": {
                    "uuid": "EF6803019B3549339B1052FFA9740042",
                    "path": "EF6803009B3549339B1052FFA9740042/EF6803019B3549339B1052FFA9740042",
                    "value": [
                      1,
                      0,
                      0,
                      0,
                      0
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6803039B3549339B1052FFA9740042": {
                    "uuid": "EF6803039B3549339B1052FFA9740042",
                    "path": "EF6803009B3549339B1052FFA9740042/EF6803039B3549339B1052FFA9740042",
                    "value": [
                      0,
                      0,
                      0,
                      0
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  }
                }
              },
              "EF6805009B3549339B1052FFA9740042": {
                "uuid": "EF6805009B3549339B1052FFA9740042",
                "characteristics": {
                  "EF6805019B3549339B1052FFA9740042": {
                    "uuid": "EF6805019B3549339B1052FFA9740042",
                    "path": "EF6805009B3549339B1052FFA9740042/EF6805019B3549339B1052FFA9740042",
                    "value": [
                      1,
                      1
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6805029B3549339B1052FFA9740042": {
                    "uuid": "EF6805029B3549339B1052FFA9740042",
                    "path": "EF6805009B3549339B1052FFA9740042/EF6805029B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": true,
                      "write": false,
                      "notify": false,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {}
                  },
                  "EF6805039B3549339B1052FFA9740042": {
                    "uuid": "EF6805039B3549339B1052FFA9740042",
                    "path": "EF6805009B3549339B1052FFA9740042/EF6805039B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6805009B3549339B1052FFA9740042/EF6805039B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  },
                  "EF6805049B3549339B1052FFA9740042": {
                    "uuid": "EF6805049B3549339B1052FFA9740042",
                    "path": "EF6805009B3549339B1052FFA9740042/EF6805049B3549339B1052FFA9740042",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "EF6805009B3549339B1052FFA9740042/EF6805049B3549339B1052FFA9740042/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  }
                }
              },
              "180F": {
                "uuid": "180F",
                "characteristics": {
                  "2A19": {
                    "uuid": "2A19",
                    "path": "180F/2A19",
                    "value": [
                      92
                    ],
                    "properties": {
                      "read": true,
                      "writeWithoutResponse": false,
                      "write": false,
                      "notify": true,
                      "indicate": false,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "180F/2A19/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  }
                }
              },
              "FE59": {
                "uuid": "FE59",
                "characteristics": {
                  "8EC90003F3154F609FB8838830DAEA50": {
                    "uuid": "8EC90003F3154F609FB8838830DAEA50",
                    "path": "FE59/8EC90003F3154F609FB8838830DAEA50",
                    "value": [],
                    "properties": {
                      "read": false,
                      "writeWithoutResponse": false,
                      "write": true,
                      "notify": false,
                      "indicate": true,
                      "authorizedSignedWrite": false,
                      "broadcast": false
                    },
                    "descriptors": {
                      "2902": {
                        "uuid": "2902",
                        "path": "FE59/8EC90003F3154F609FB8838830DAEA50/2902",
                        "value": [
                          0,
                          0
                        ]
                      }
                    }
                  }
                }
              }
            }
          },
          "inbound_count": 10025,
          "inbound_count_max": 100000
        })}).promise();      
  }
}
