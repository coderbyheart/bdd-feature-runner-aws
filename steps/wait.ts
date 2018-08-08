import { StepRunner } from '../lib/runner';
import { regexMatcher } from '../lib/regexMatcher';
import { ElivagarWorld } from '../run-features';

export const runners: StepRunner<ElivagarWorld>[] = [
  {
    willRun: regexMatcher(/^I wait ([0-9]+) seconds?/),
    run: async ([time]) =>
      new Promise(resolve => {
        setTimeout(resolve, +time * 1000);
      }),
  },
];
