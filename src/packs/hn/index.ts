import type { Pack } from '@/engine';
import type { Comment } from './comment';
import { controls } from './controls';
import { rules } from './rules';

export type { Comment } from './comment';

/** Hacker News: which comments of a thread are worth reading. The half that reads the page is in `./page`. */
export const pack: Pack<Comment> = {
	id: 'hn',
	name: 'Hacker News',
	description:
		'In a thread, tells apart the comments that know what they talk about, the sneers and the ones that wander off the subject.',
	sites: ['https://news.ycombinator.com/*'],
	items: 'comments',
	controls,
	rules
};
