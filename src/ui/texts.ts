import type { Sensitivity } from '@/engine';

/** The words every pack's controls share. A pack's own controls bring their own. */
export const texts = {
	sensitivity: {
		title: 'Sensitivity',
		stops: { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' } satisfies Record<
			Sensitivity,
			string
		>,
		help: {
			low: 'Only the clear cases. Few labels, few misses.',
			medium: 'A balance.',
			high: 'Labels more, and gets more wrong.',
			ultra: 'Labels at the faintest hunch. Expect plenty of misses.'
		} satisfies Record<Sensitivity, string>
	}
};
