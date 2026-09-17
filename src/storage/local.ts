import { storage } from 'wxt/utils/storage';
import { packSettingsOf } from '@/engine';
import type { Pack, PackSettings } from '@/engine';
import { inTurn } from './in-turn';
import type { Counters, Sensitivity, Settings } from './types';

// Local storage stays in this browser and survives closing it. The key is in it, so the background
// closes it to the content script inside a page, which must not so much as load this file:
// an item looks itself up as soon as it is defined.

export const defaultSettings: Settings = { paused: false, tuning: false, lookAhead: 3, packs: {} };
export const noCounters: Counters = { items: 0, tokensIn: 0, tokensOut: 0 };

/** Settings as Barrunto 1 kept them, when X.com was all there was. */
interface SettingsV1 {
	paused: boolean;
	sensitivity: Sensitivity;
	tuning: boolean;
}

export const apiKey = storage.defineItem<string | null>('local:key', {
	fallback: null,
	version: 1
});

const FADED: PackSettings['treatments'] = { snark: 'fade', tangent: 'fade' };

/** A pack's settings before each noise judgment had its treatment, when fading was a control of Hacker News's own. */
type PackSettingsV3 = Omit<PackSettings, 'treatments'>;
interface SettingsV2 {
	paused: boolean;
	tuning: boolean;
	packs: Record<string, PackSettingsV3>;
}
type SettingsV3 = SettingsV2 & { lookAhead: number };

export const settings = storage.defineItem<Settings>('local:settings', {
	fallback: defaultSettings,
	version: 4,
	migrations: {
		// X.com stays on for whoever had it, with the sensitivity they had chosen.
		2: ({ paused, sensitivity, tuning }: SettingsV1): SettingsV2 => ({
			paused,
			tuning,
			packs: { x: { enabled: true, sensitivity, options: {} } }
		}),
		3: (before: SettingsV2): SettingsV3 => ({
			...before,
			lookAhead: defaultSettings.lookAhead
		}),
		// Whoever had Hacker News fade its noise keeps it faded.
		4: (before: SettingsV3): Settings => ({
			...before,
			packs: Object.fromEntries(
				Object.entries(before.packs).map(
					([
						id,
						{
							options: { fade, ...options },
							...chosen
						}
					]) => [
						id,
						{
							...chosen,
							options,
							treatments: id === 'hn' && fade ? FADED : {}
						}
					]
				)
			)
		})
	}
});

export const totalCounters = storage.defineItem<Counters>('local:totalCounters', {
	fallback: noCounters,
	version: 2,
	migrations: {
		2: ({ posts, ...usage }: Omit<Counters, 'items'> & { posts: number }): Counters => ({
			items: posts,
			...usage
		})
	}
});

/** Changes what the user has chosen for one pack, and leaves the rest as it is. */
export function changePack(
	pack: Pack,
	change: (chosen: PackSettings) => Partial<PackSettings>
): Promise<void> {
	return inTurn(async () => {
		const now = await settings.getValue();
		const chosen = packSettingsOf(pack, now.packs[pack.id]);
		await settings.setValue({
			...now,
			packs: { ...now.packs, [pack.id]: { ...chosen, ...change(chosen) } }
		});
	});
}
