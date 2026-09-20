import type { Pack } from '@/engine';
import { card } from './card';
import type { Profile } from './profile';
import { rules } from './rules';

export type { Profile } from './profile';

/**
 * Jetective Jev: on a profile of X.com, a case file on the account. It shares X.com with the pack
 * that labels posts, and is turned on and off by itself. The half that reads the page is in `./page`.
 */
export const pack: Pack<Profile> = {
	id: 'jetective',
	name: 'Jetective Jev',
	description:
		'On a profile, a case file on the account: what it looks like, and the exhibits for and against.',
	sites: ['https://x.com/*'],
	rules,
	card
};
