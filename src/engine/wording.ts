import { fnv1a } from './hash';
import type { Trait } from './types';

/**
 * A short name for the questions as they are worded now. Answers are kept under it, so that answers
 * to questions that have since been reworded are not taken for answers to the new ones.
 */
export const wordingOf = (traits: Trait[]): string => fnv1a(JSON.stringify(traits)).toString(36);
