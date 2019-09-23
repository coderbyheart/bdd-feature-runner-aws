import * as jsonata from 'jsonata'
import { expect } from 'chai'
import { StepRunner, Store } from '../lib/runner'
import { regexMatcher } from '../lib/regexMatcher'
import { WebhookReceiver } from '../lib/webhook-receiver'

let r: WebhookReceiver

type StoreWithWorld = Store & {
	webhookQueue: string
}

export const webhookStepRunners = <W extends StoreWithWorld>(): StepRunner<
	W
>[] => [
	regexMatcher(/^the Webhook Receiver "([^"]+)" should be called$/)(
		async ([MessageGroupId], _, runner) =>
			r.receiveWebhookRequest(MessageGroupId, runner).then(r => r.body),
	),
	regexMatcher(
		/^"([^"]+)" of the webhook request body should equal "([^"]+)"$/,
	)(async ([exp, expected]) => {
		const e = jsonata(exp)
		expect(r.latestWebhookRequest).not.to.be.an('undefined')
		const b = r.latestWebhookRequest && r.latestWebhookRequest.body
		expect(b).not.to.be.an('undefined')
		const result = e.evaluate(b)
		expect(result).to.deep.equal(expected)
		return b
	}),
	regexMatcher(/^the webhook request body should equal this JSON$/)(
		async (_, step) => {
			if (!step.interpolatedArgument) {
				throw new Error('Must provide argument!')
			}
			const j = JSON.parse(step.interpolatedArgument)
			const b = r.latestWebhookRequest && r.latestWebhookRequest.body
			expect(b).not.to.be.an('undefined')
			expect(b).to.deep.equal(j)
			return b
		},
	),
	regexMatcher(/^I have a Webhook Receiver/)(async (_, __, runner) => {
		r = new WebhookReceiver((runner.world as StoreWithWorld).webhookQueue)
		await r.clearQueue()
	}),
]
