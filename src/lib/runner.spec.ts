import * as path from 'path'
import { FeatureRunner } from './runner'

describe('runner', () => {
	describe('@Retry', () => {
		it('should be configurable', async () => {
			const result = await new FeatureRunner(
				{},
				{
					dir: path.join(process.cwd(), 'test', 'backoff'),
				},
			).run()

			expect(result.success).toEqual(false)
			expect(result.featureResults[0].scenarioResults[0].success).toEqual(false)
			expect(result.featureResults[0].scenarioResults[0].tries).toEqual(3)
			expect(
				result.featureResults[0].scenarioResults[0].retryConfiguration,
			).toEqual({
				initialDelay: 50,
				maxDelay: 100,
				failAfter: 3,
			})
		})
	})
})
