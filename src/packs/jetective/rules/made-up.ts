import type { Answers } from '@/engine';
import { MOST_POSTS } from '../profile';
import type { Profile, ProfilePost } from '../profile';
import { KINDS } from './kinds';
import type { Kind } from './kinds';
import { traits } from './traits';

// Made-up accounts and answers, for the tests of this pack and of what shows its card.

export const READ_AT = '2026-01-01T00:00:00.000Z';
export const yearsAgo = (years: number) =>
	new Date(Date.parse(READ_AT) - years * 365 * 86_400_000).toISOString();

/** So that no two made-up posts say the same. */
const ABOUT = [
	'rain',
	'bread',
	'trains',
	'chess',
	'maps',
	'bees',
	'paint',
	'tides',
	'knots',
	'owls'
];
const about = (n: number) =>
	`${ABOUT[n % ABOUT.length]} and ${ABOUT[Math.floor(n / ABOUT.length) % ABOUT.length]}`;

/** So many posts, one every so many minutes, the latest first. */
export const posts = (count: number, minutes = 600): ProfilePost[] =>
	Array.from({ length: count }, (_, n) => ({
		id: String(n),
		text: `Made-up words about ${about(n)}.`,
		at: new Date(Date.parse(READ_AT) - n * minutes * 60_000).toISOString(),
		pinned: false,
		hasLink: false
	}));

export const account = (change: Partial<Profile> = {}): Profile => ({
	id: 'ada_nobody',
	handle: 'ada_nobody',
	name: 'Ada Nobody',
	bio: 'Made-up words of a bio.',
	posts: posts(14),
	created: yearsAgo(3),
	followers: 300,
	following: 280,
	postCount: 1500,
	readAt: READ_AT,
	...change
});

/**
 * What Jev might answer about an account: a clear no to everything asked of it as a whole, but
 * what is `given`; and of its posts, so many of each kind in `kinds`, clearly, and the rest `other`.
 */
export function answersFor(
	profile: Profile,
	kinds: Partial<Record<Kind, number>> = {},
	given: Answers = {}
): Answers {
	const answers: Answers = { ...Object.fromEntries(traits.map((t) => [t.id, 0.05])), ...given };
	const each = (Object.entries(kinds) as [Kind, number][]).flatMap(([kind, n]) =>
		Array.from({ length: n }, () => kind)
	);
	const others = Object.keys(KINDS).length - 1;
	profile.posts.slice(0, MOST_POSTS).forEach((_, i) => {
		const is = each[i] ?? 'other';
		for (const kind of Object.keys(KINDS)) {
			answers[`post${i}.${kind}`] = kind === is ? 0.93 : 0.07 / others;
		}
	});
	return answers;
}
