import type { Pack, PackSettings } from './types';

/** What the user has chosen for a pack, with whatever they have not touched as the pack ships it: off. */
export function packSettingsOf(pack: Pack, stored: PackSettings | undefined): PackSettings {
	const initial = Object.fromEntries(pack.controls.map((c) => [c.id, c.initial]));
	return {
		enabled: stored?.enabled ?? false,
		sensitivity: stored?.sensitivity ?? 'medium',
		options: { ...initial, ...stored?.options }
	};
}
