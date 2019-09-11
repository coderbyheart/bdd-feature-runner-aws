import { InterpolatedStep } from './runner'

export const regexMatcher = (rx: RegExp) => (
	step: InterpolatedStep,
): false | string[] => {
	const m = rx.exec(step.interpolatedText)
	if (!m) {
		return false
	}
	return m.slice(1)
}
