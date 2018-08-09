import { Iot } from 'aws-sdk';
import { FeatureRunner } from '../lib/runner';
import { ElivagarWorld } from '../run-features';

const iot = new Iot();

/**
 * Remove Things and Certificates which have been created
 *
 * This can be removed once we have implemented the API for that
 */
export const cleanup = async (runner: FeatureRunner<ElivagarWorld>) => {
  const { things } = await iot
    .listThings({
      maxResults: 2, // This is a safety so we do not delete too many devices in case this is run against production
      attributeName: 'stage',
      attributeValue: runner.world.stage,
    })
    .promise();

  return Promise.all(
    (things || []).map(
      ({ thingName }) =>
        new Promise(async resolve => {
          if (!thingName) {
            throw new Error('No thingName given');
          }
          const principals = await iot
            .listThingPrincipals({ thingName })
            .promise();

          if (principals.principals && principals.principals.length) {
            const principal = principals.principals[0];
            await iot
              .detachThingPrincipal({
                thingName,
                principal,
              })
              .promise();
            const certificateId = principal.split('/')[1];
            await iot
              .updateCertificate({
                certificateId,
                newStatus: 'INACTIVE',
              })
              .promise();
            await iot
              .detachPrincipalPolicy({
                policyName: runner.world.thingPolicy,
                principal,
              })
              .promise();
            // Give time to detach
            await new Promise(resolve => {
              setTimeout(resolve, 1000);
            });
            await iot.deleteCertificate({ certificateId }).promise();
          }
          await iot.deleteThing({ thingName }).promise();
          resolve();
        }),
    ),
  );
};
