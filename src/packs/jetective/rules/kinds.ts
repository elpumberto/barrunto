import type { Answers, Trait } from '@/engine';
import { MOST_POSTS } from '../profile';
import type { Profile } from '../profile';

/**
 * The kinds of post Jev tells apart, one by one: what an account does is what its posts are. Code
 * then counts them. Showing what one has made is not selling: the difference is what is said of it.
 */
export const KINDS = {
	own: 'Tells of something particular the author did, saw, lived through or thinks, in words of their own. A real reply to what somebody said is this too.',
	made: 'Shows or tells of something the author made or is making: a project, a piece of work, a release, an experiment, with what it is, how it works or how it went.',
	stock:
		'A remark that would fit under any post whatsoever: stock praise, agreement or filler, such as "Great post!", "So true", "Love this".',
	advert:
		'Pushes something to buy, join, click or sign up for, with a pitch and little else: a product, a token, a channel, a service, a "link in bio".',
	money:
		'Promises the reader money or the recovery of something lost (earnings, returns, a giveaway, funds or an account got back), or sends them to somebody who is said to do that.',
	bait: 'Asks its readers to react: to reply, like, repost, follow, tag someone or vote; or throws a this-or-that question at the crowd to get replies.',
	recycled:
		'Stock material that goes round, with nothing of the author in it: a famous quote, a viral fact, a motivational line, tips anyone could post.',
	other: 'None of these: news passed on, a bare link or picture, a greeting, something else.'
} as const;

export type Kind = keyof typeof KINDS;

/** The posts Jev is asked about. The page half reads no more than these, but what comes from a page is not taken on trust. */
export const asked = ({ posts }: Profile) => posts.slice(0, MOST_POSTS);

/** One question for each post asked about. They point at it by its place among the ones Jev is shown. */
export const postTraits = (profile: Profile): Trait[] =>
	asked(profile).map((_, i) => ({
		id: `post${i}`,
		name: `post ${i + 1}`,
		question: `What kind of post is \`profile.posts[${i}]\`? Judge that post alone, not the account.`,
		options: KINDS
	}));

const chance = (answers: Answers, post: number, kind: Kind) => answers[`post${post}.${kind}`] ?? 0;

/** How much of what the account posts is of a kind, from 0 to 1: the chance Jev gave it, post by post, on average. */
export function share(kind: Kind, profile: Profile, answers: Answers): number {
	const posts = asked(profile);
	if (!posts.length) return 0;
	return posts.reduce((sum, _, i) => sum + chance(answers, i, kind), 0) / posts.length;
}

/** The most Jev gave any one post of being of a kind. */
export const most = (kind: Kind, profile: Profile, answers: Answers): number =>
	Math.max(0, ...asked(profile).map((_, i) => chance(answers, i, kind)));

/** In how many of the posts a kind is the likeliest, and of how many: what a card can say and a reader can check. */
export function count(kind: Kind, profile: Profile, answers: Answers): { of: number; all: number } {
	const kinds = Object.keys(KINDS) as Kind[];
	const posts = asked(profile);
	const likeliest = (i: number) =>
		kinds.reduce((best, k) => (chance(answers, i, k) > chance(answers, i, best) ? k : best));
	// A post Jev said nothing of is of no kind, and not of the first there is.
	const is = (i: number) => chance(answers, i, kind) > 0 && likeliest(i) === kind;
	return { of: posts.filter((_, i) => is(i)).length, all: posts.length };
}
