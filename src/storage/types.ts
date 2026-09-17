import type { Sensitivity, Usage } from '@/engine';

// The popup may not use the engine; the sensitivity is part of the settings, and it gets it from here.
export { SENSITIVITIES } from '@/engine';
export type { Sensitivity, Usage };

export interface Settings {
	paused: boolean;
	sensitivity: Sensitivity;
	tuning: boolean;
}

/** Posts analyzed and usage. */
export interface Counters extends Usage {
	posts: number;
}

/** Why a call to Jev went wrong with a good key. */
export type Trouble = 'tooManyCalls' | 'serviceDown' | 'noNetwork';

export type ConnectionStatus =
	| { state: 'noKey' }
	| { state: 'connected' }
	| { state: 'keyRejected' }
	| { state: 'trouble'; reason: Trouble };
