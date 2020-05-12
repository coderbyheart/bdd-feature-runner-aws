import { messages as cucumber } from 'cucumber-messages'

export type RetryConfiguration = {
	initialDelay: number
	maxDelay: number
	failAfter: number
}

// This retries a scenario up to 31 seconds
export const defaultRetryConfig: RetryConfiguration = {
	initialDelay: 1000,
	maxDelay: 16000,
	failAfter: 5,
}

export const retryConfiguration = (
	scenario: cucumber.GherkinDocument.Feature.IScenario,
): RetryConfiguration => {
	const retryTag = scenario?.tags?.find((tag) => /^@Retry=/.test(`${tag.name}`))
	if (!retryTag) return defaultRetryConfig
	return (
		retryTag?.name
			?.split('=')[1]
			.split(',')
			.reduce((settings, config) => {
				const [k, v] = config.split(':')
				return {
					...settings,
					[k]: parseInt(v, 10),
				}
			}, defaultRetryConfig) ?? defaultRetryConfig
	)
}
