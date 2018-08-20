import * as jsonata from 'jsonata';
import { expect } from 'chai';
import { StepRunner } from '../lib/runner';
import { regexMatcher } from '../lib/regexMatcher';
import { ElivagarWorld } from '../run-features';
import { WebhookReceiver } from '../lib/webhook-receiver';

let r: WebhookReceiver;

export const runners: StepRunner<ElivagarWorld>[] = [
  {
    willRun: regexMatcher(/^the Webhook Receiver "([^"]+)" should be called$/),
    run: async ([MessageGroupId], _, runner) =>
      r.receiveWebhookRequest(MessageGroupId, runner).then(r => r.body),
  },
  {
    willRun: regexMatcher(
      /^"([^"]+)" of the webhook request body should equal "([^"]+)"$/,
    ),
    run: async ([exp, expected]) => {
      const e = jsonata(exp);
      expect(r.latestWebhookRequest).not.to.be.an('undefined');
      const b = r.latestWebhookRequest && r.latestWebhookRequest.body;
      expect(b).not.to.be.an('undefined');
      const result = e.evaluate(b);
      expect(result).to.deep.equal(expected);
      return b;
    },
  },
  {
    willRun: regexMatcher(/^the webhook request body should equal this JSON$/),
    run: async (_, step) => {
      if (!step.interpolatedArgument) throw new Error('Must provide argument!');
      const j = JSON.parse(step.interpolatedArgument);
      const b = r.latestWebhookRequest && r.latestWebhookRequest.body;
      expect(b).not.to.be.an('undefined');
      expect(b).to.deep.equal(j);
      return b;
    },
  },
  {
    willRun: regexMatcher(/^I have a Webhook Receiver/),
    run: async (_, __, runner) => {
      r = new WebhookReceiver(runner.world.webhookQueue);
      await r.clearQueue();
    },
  },
];
