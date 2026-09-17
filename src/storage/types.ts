import type { PackSettings, Sensitivity, Usage } from '@/engine';

export type { PackSettings, Sensitivity, Usage };

export interface Settings {
	paused: boolean;
	tuning: boolean;
	/**
	 * How many items past the last one on screen are asked about before the user reaches them.
	 * With none, an item is asked about only once it has stayed on screen for a moment.
	 */
	lookAhead: number;
	/** Whether what the user writes on a site is read too, to tell them how it would be read, where a pack can. */
	checkDrafts: boolean;
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

/** Settings as they are until the user changes them. The page's copy starts the same, before the background fills it in. */
export const defaultSettings: Settings = {
	paused: false,
	tuning: false,
	lookAhead: 3,
	checkDrafts: true,
	packs: {}
};
