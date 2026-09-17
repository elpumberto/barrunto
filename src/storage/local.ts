import { storage } from 'wxt/utils/storage';
import { packSettingsOf } from '@/engine';
import type { Pack, PackSettings, Treatment } from '@/engine';
import { takingTurns } from './in-turn';
import { defaultSettings } from './types';
import type { Counters, Sensitivity, Settings } from './types';

// Local storage stays in this browser and survives closing it. The key is in it, so the background
// closes it to the content script inside a page, which must not so much as load this file:
// an item looks itself up as soon as it is defined.

const inTurn = takingTurns();

export { defaultSettings };
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

/** What Hacker News's own control for fading its noise, on or off, comes to now. */
const HN_NOISE = ['snark', 'tangent'];

/** A pack's settings in versions 2 and 3: before each noise judgment had its treatment, when fading was a control of Hacker News's own. */
type PackSettingsV3 = Omit<PackSettings, 'treatments'> & { options?: Record<string, boolean> };
/** Version 4 still kept a place for controls of a pack's own, which no pack has. */
type SettingsV5 = Omit<Settings, 'checkDrafts'>;
type SettingsV4 = Omit<SettingsV5, 'packs'> & {
	packs: Record<string, PackSettings & { options?: unknown }>;
};
interface SettingsV2 {
	paused: boolean;
	tuning: boolean;
	packs: Record<string, PackSettingsV3>;
}
type SettingsV3 = SettingsV2 & { lookAhead: number };

export const settings = storage.defineItem<Settings>('local:settings', {
	fallback: defaultSettings,
	version: 6,
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
		// Whoever had Hacker News fade its noise keeps it faded, and whoever had it not, only labelled.
		4: (before: SettingsV3): SettingsV4 => ({
			...before,
			packs: Object.fromEntries(
				Object.entries(before.packs).map(([id, { options = {}, ...chosen }]) => {
					const { fade, ...rest } = options;
					const asked: Treatment = fade ? 'fade' : 'label';
					const treatments: PackSettings['treatments'] =
						id === 'hn' ? Object.fromEntries(HN_NOISE.map((j) => [j, asked])) : {};
					return [id, { ...chosen, options: rest, treatments }];
				})
			)
		}),
		5: ({ packs: before, ...rest }: SettingsV4): SettingsV5 => ({
			...rest,
			packs: Object.fromEntries(
				Object.entries(before).map(([id, { enabled, sensitivity, treatments }]) => [
					id,
					{ enabled, sensitivity, treatments }
				])
			)
		}),
		6: (before: SettingsV5): Settings => ({ ...before, checkDrafts: defaultSettings.checkDrafts })
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

/** Changes settings that are not a pack's, from what is stored now and not from what someone read a while ago. */
export function changeSettings(change: Partial<Omit<Settings, 'packs'>>): Promise<void> {
	return inTurn(async () => settings.setValue({ ...(await settings.getValue()), ...change }));
}
