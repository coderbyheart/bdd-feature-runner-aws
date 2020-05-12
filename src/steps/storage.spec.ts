import * as path from 'path'
import { FeatureRunner } from '../lib/runner'
import { storageStepRunners } from './storage'

test('storageSteps', async () => {
	const runner = new FeatureRunner<any>(
		{},
		{
			reporters: [],
			dir: path.join(process.cwd(), 'test', 'storage'),
			retry: false,
			store: {
				foo: 'bar',
				bar: {
					baz: 'foo',
					num: 42,
					b: true,
				},
			},
		},
	)

	const { success, store } = await runner
		.addStepRunners(storageStepRunners())
		.run()

	expect(success).toEqual(true)
	expect(store.escapedJSON).toEqual(
		'"{\\"baz\\":\\"foo\\",\\"num\\":42,\\"b\\":true}"',
	)
})
