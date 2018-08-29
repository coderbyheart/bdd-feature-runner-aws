import { StepRunner } from '../lib/runner';
import { regexMatcher } from '../lib/regexMatcher';
import { ElivagarWorld } from '../run-features';
import { GatewayHelper } from '../lib/gateway-helper';

const c = new GatewayHelper();

export const runners: StepRunner<ElivagarWorld>[] = [
  {
    willRun: regexMatcher(/^I have registered a Gateway as ([^"]+)$/),
    run: async ([gatewayAddressStorage], __, runner) => {
      const { thingName } = await c.createTestGateway(runner);
      runner.store[gatewayAddressStorage] = thingName;
      runner.progress('IRIS', `Registered Gateway ${thingName}`);
      return thingName;
    },
  },
  {
    willRun: regexMatcher(/^I have connected a [^"]+ with ([^"]+) to ([^"]+)$/),
    run: async ([thingAddressStorage, gatewayId], _, runner) => {
      const bdAddr = 'CA:B2:31:EE:E0:9E';
      await c.addDevice(runner, gatewayId, bdAddr);
      runner.progress('IRIS', `Attached ${bdAddr} to Gateway ${gatewayId}`);
      runner.store[thingAddressStorage] = bdAddr;
      return bdAddr;
    },
  },
];
