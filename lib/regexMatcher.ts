import { InterpolatedStep } from './runner';

export const regexMatcher = (rx: RegExp) => (
  step: InterpolatedStep,
): false | string[] => {
  const m = step.interpolatedText.match(rx);
  if (!m) return false;
  return m.slice(1);
};
