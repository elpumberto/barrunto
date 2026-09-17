import type { Pack } from '@/engine';
import type { Comment } from './comment';
import { rules } from './rules';

export type { Comment } from './comment';

/** Hacker News: which comments of a thread are worth reading. The half that reads the page is in `./page`. */
export const pack: Pack<Comment> = {
	id: 'hn',
	name: 'Hacker News',
	description:
		'Tells apart the comments that know the subject, the sneers and the ones that wander off it.',
	sites: ['https://news.ycombinator.com/*'],
	rules
};
