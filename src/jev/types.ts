import type { Answers, Presented, Trait, Usage } from '@/engine';

export type JevFailure = 'noKey' | 'keyRejected' | 'tooManyCalls' | 'serviceDown' | 'noNetwork';

/** Everything that can go wrong talking to Jev, reduced to a short list. */
export class JevError extends Error {
	constructor(readonly failure: JevFailure) {
		super(failure);
		this.name = 'JevError';
	}
}

/** The two doors to Jev. Both throw a JevError when they fail. */
export interface Jev {
	/** Asks about the content, in a single call, the question of every trait. */
	ask(
		apiKey: string,
		content: Presented,
		traits: Trait[]
	): Promise<{ answers: Answers; usage: Usage }>;
	/** Resolves if the key is good. */
	checkKey(apiKey: string): Promise<void>;
}
