import type { Pack } from './types';

/** The sites of these packs, each once: two packs may act on the same site. */
export const sitesOf = (packs: Pack[]): string[] => [...new Set(packs.flatMap((p) => p.sites))];

/**
 * The sites of a pack that none of these others acts on. They are what is given back to Chrome when
 * the pack is turned off: leave for a site stays while another pack the user wants needs it.
 */
export function sitesOnlyOf(pack: Pack, others: Pack[]): string[] {
	const shared = sitesOf(others.filter((other) => other.id !== pack.id));
	return pack.sites.filter((site) => !shared.includes(site));
}
