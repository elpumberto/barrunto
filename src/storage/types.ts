import type { PackSettings, Sensitivity, Usage } from '@/engine';

// The popup may not use the engine; the sensitivity is part of the settings, and it gets it from here.
export { SENSITIVITIES } from '@/engine';
export type { PackSettings, Sensitivity, Usage };

export interface Settings {
	paused: boolean;
	tuning: boolean;
	/**
	 * How many items past the last one on screen are asked about before the user reaches them.
	 * With none, an item is asked about only once it has stayed on screen for a moment.
	 */
	lookAhead: number;
	/** What the user has chosen for each pack, by pack id. A pack that is not here is as it ships: off. */
	packs: Record<string, PackSettings>;
}

/** Items analyzed and usage. */
export interface Counters extends Usage {
	items: number;
}

/** Why a call to Jev went wrong with a good key. */
export type Trouble = 'tooManyCalls' | 'serviceDown' | 'noNetwork';

export type ConnectionStatus =
	| { state: 'noKey' }
	| { state: 'connected' }
	| { state: 'keyRejected' }
	| { state: 'trouble'; reason: Trouble };

/** The most items that may be asked about ahead: every one of them is paid for, read or not. */
export const MOST_AHEAD = 50;
