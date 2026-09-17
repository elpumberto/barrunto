import type { Pack, PackSettings } from './types';

/** What the user has chosen for a pack, with whatever they have not touched as the pack ships it: off. */
export function packSettingsOf(pack: Pack, stored: PackSettings | undefined): PackSettings {
	const initial = Object.fromEntries(pack.controls.map((c) => [c.id, c.initial]));
	// Noise is faded until the user says otherwise: enough to tell it apart at a glance, and nothing out of sight.
	const faded = pack.rules.judgments.filter((j) => j.noise).map((j) => [j.id, 'fade']);
	return {
		enabled: stored?.enabled ?? false,
		sensitivity: stored?.sensitivity ?? 'medium',
		treatments: { ...Object.fromEntries(faded), ...stored?.treatments },
		options: { ...initial, ...stored?.options }
	};
}
