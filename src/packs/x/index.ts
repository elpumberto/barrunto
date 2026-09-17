import type { Pack } from '@/engine';
import type { Post } from './post';
import { rules } from './rules';

export type { Post } from './post';

/** X.com: what kind of thing each post on the timeline is. The half that reads the page is in `./page`. */
export const pack: Pack<Post> = {
	id: 'x',
	name: 'X',
	description:
		'Tells apart the posts made to farm reactions, the ones picking a fight and the ones worth your time.',
	sites: ['https://x.com/*'],
	controls: [],
	rules
};
