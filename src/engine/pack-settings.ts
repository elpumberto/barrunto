import { DEFAULT_TREATMENT } from './types';
import type { Pack, PackSettings } from './types';

/** What the user has chosen for a pack, with whatever they have not touched as it ships: off, at medium, its noise faded. */
export function packSettingsOf(pack: Pack, stored: PackSettings | undefined): PackSettings {
	const initial = Object.fromEntries(pack.controls.map((c) => [c.id, c.initial]));
	const asShipped = pack.rules.judgments
		.filter((j) => j.noise)
		.map((j) => [j.id, DEFAULT_TREATMENT]);
	return {
		enabled: stored?.enabled ?? false,
		sensitivity: stored?.sensitivity ?? 'medium',
		treatments: { ...Object.fromEntries(asShipped), ...stored?.treatments },
		options: { ...initial, ...stored?.options }
	};
}
