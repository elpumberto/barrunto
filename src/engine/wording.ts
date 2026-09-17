import { fnv1a } from './hash';
import type { Trait } from './types';

/**
 * A short name for the questions as they are worded now. Answers are kept under it, so that answers
 * to questions that have since been reworded are not taken for answers to the new ones.
 */
export const wordingOf = (traits: Trait[]): string =>
	// What Jev is asked, and nothing else of a trait: the name it goes by in the tuning detail is not.
	fnv1a(
		JSON.stringify(traits.map(({ id, question, yes, no }) => [id, question, yes, no]))
	).toString(36);
