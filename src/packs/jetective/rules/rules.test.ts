import { describe, expect, it } from 'vitest';
import { labelsFor, signalValue, strengthsFor, traitsFor, wordingOf } from '@/engine';
import type { Answers } from '@/engine';
import { card } from '../card';
import { MOST_POSTS } from '../profile';
import type { Profile } from '../profile';
import { answersFor } from './made-up';
import { rules } from '.';

let posted = 0;
const post = (text: string, at: string | null = null, pinned = false, hasLink = false) => ({
	id: String(posted++),
	text,
	at,
	pinned,
	hasLink
});
const profile: Profile = {
	id: 'ada_nobody',
	handle: 'ada_nobody',
	name: 'Ada Nobody',
	bio: 'b'.repeat(900),
	posts: Array.from({ length: 50 }, () => post('x'.repeat(900))),
	created: '2020-01-01T00:00:00.000Z',
	followers: 500,
	following: 300,
	postCount: 2000,
	readAt: '2026-01-01T00:00:00.000Z'
};
const presented = rules.present(profile) as { profile: Record<string, unknown> };

// What holds for the rules of every pack is in `packs.test.ts`.
describe("Jetective Jev's rules", () => {
	it('shows Jev the name, the bio and the words of the posts, and nothing else', () => {
		expect(Object.keys(presented.profile).sort()).toEqual(['bio', 'name', 'posts']);
		expect(JSON.stringify(presented)).not.toContain('ada_nobody');
		expect(JSON.stringify(presented)).not.toContain('2020');
	});

	it('points in its questions only at fields the profile is presented with', () => {
		for (const { question, yes = '', no = '' } of traitsFor(rules, profile)) {
			for (const [, field] of `${question} ${yes} ${no}`.matchAll(/`profile\.(\w+)/g)) {
				expect(Object.keys(presented.profile), question).toContain(field);
			}
		}
	});

	it('cuts what it sends to Jev to a length', () => {
		const sent = presented.profile as { bio: string; posts: string[] };
		expect(sent.bio).toHaveLength(400);
		expect(sent.posts).toHaveLength(MOST_POSTS);
		expect(sent.posts[0]).toHaveLength(400);
	});

	it('asks of each post Jev is shown, by its place among them, what kind it is, and of no other', () => {
		const ofPosts = rules.traitsOf!(profile);
		expect(ofPosts).toHaveLength(MOST_POSTS);
		expect(ofPosts[3]).toMatchObject({
			id: 'post3',
			question: expect.stringContaining('`profile.posts[3]`')
		});
		expect(Object.keys(ofPosts[3]!.options!)).toContain('made');
		expect(rules.traitsOf!({ ...profile, posts: profile.posts.slice(0, 2) })).toHaveLength(2);
		const ids = traitsFor(rules, profile).map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('takes nobody for noise: an account is never faded or hidden', () => {
		expect(rules.judgments.filter((j) => j.noise)).toEqual([]);
	});

	it('charges nobody for what their account is like, with nothing in what it does', () => {
		const suspectLooking: Profile = {
			...profile,
			handle: 'ada84620193',
			created: '2025-12-25T00:00:00.000Z',
			followers: 3,
			following: 4000,
			postCount: 40,
			// Posts enough, and of no kind: nothing else holds a charge back, or pushes it.
			posts: ['rain', 'bread', 'trains', 'chess', 'maps', 'bees', 'paint', 'tides', 'knots', 'owls']
				.flatMap((about) => [`Words about ${about}.`, `More on ${about}, at length.`])
				.map((text) => post(text))
		};
		const nothing = answersFor(suspectLooking);
		expect(
			labelsFor(rules.judgments, strengthsFor(rules, nothing, suspectLooking), 'ultra')
		).toEqual([]);
	});

	it('says of every charge that it looks like, and never that it is', () => {
		for (const charge of Object.values(card.charges)) expect(charge).toMatch(/^Looks like /);
	});

	it('names the wording of the questions differently when one changes, of the account or of a post', () => {
		const asked = traitsFor(rules, profile);
		const reworded = asked.map((t) =>
			t.id === 'post0' ? { ...t, options: { ...t.options, own: 'Mine.' } } : t
		);
		expect(wordingOf(reworded)).not.toBe(wordingOf(asked));
		expect(wordingOf([...asked])).toBe(wordingOf(asked));
	});
});

describe('what is counted of what Jev said of the posts', () => {
	const ten = { ...profile, posts: profile.posts.slice(0, 10) };
	const value = (id: string, answers: Answers) =>
		signalValue(
			rules.signals.find((s) => s.id === id)!,
			ten,
			answers
		);

	it('is how much of what the account posts is of each kind, and nothing before Jev has answered', () => {
		const answers = answersFor(ten, { advert: 7, own: 3 });
		expect(value('advertShare', answers)).toBeCloseTo(0.7 * 0.93 + 0.3 * 0.01);
		expect(value('ownShare', answers)).toBeCloseTo(0.3 * 0.93 + 0.7 * 0.01);
		expect(value('madeShare', answers)).toBeCloseTo(0.01);
		expect(value('advertShare', {})).toBe(0);
		expect(
			signalValue(
				rules.signals.find((s) => s.id === 'advertShare')!,
				ten
			)
		).toBe(0);
	});

	it('is one post that plainly promises money, among however many that do not', () => {
		expect(value('moneyPost', answersFor(ten, { own: 9, money: 1 }))).toBe(1);
		expect(value('moneyPost', answersFor(ten, { own: 10 }))).toBe(0);
	});

	it('is told on the card as so many posts of so many, and not at all when it comes to none', () => {
		const answers = answersFor(ten, { advert: 7, own: 3 });
		const said = (id: string) => {
			const evidence = card.evidence[id]!;
			return typeof evidence === 'string' ? evidence : evidence.say(ten, answers);
		};
		expect(said('advertShare')).toBe('7 of 10 posts read as adverts.');
		expect(said('madeShare')).toBe('');
		// Before Jev has answered, no post is of any kind: not of the first there is, either.
		const evidence = card.evidence.ownShare!;
		expect(typeof evidence === 'string' ? evidence : evidence.say(ten, {})).toBe('');
	});
});

describe('the page signals', () => {
	const value = (id: string, change: Partial<Profile>) =>
		signalValue(
			rules.signals.find((s) => s.id === id)!,
			{ ...profile, ...change }
		);
	const daysAgo = (days: number) =>
		new Date(Date.parse(profile.readAt) - days * 86_400_000).toISOString();

	it('new account: everything up to a month, nothing from a year', () => {
		expect(value('newAccount', { created: daysAgo(10) })).toBe(1);
		expect(value('newAccount', { created: daysAgo(30) })).toBeCloseTo(1);
		expect(value('newAccount', { created: daysAgo(365) })).toBeCloseTo(0);
		expect(value('newAccount', { created: daysAgo(3000) })).toBe(0);
	});

	it('old account: nothing up to two years, everything from six', () => {
		expect(value('oldAccount', { created: daysAgo(2 * 365) })).toBeCloseTo(0);
		expect(value('oldAccount', { created: daysAgo(4 * 365) })).toBeCloseTo(0.5);
		expect(value('oldAccount', { created: daysAgo(9 * 365) })).toBe(1);
	});

	it('follows far more: from twice as many, up to ten times, and little with a handful followed', () => {
		expect(value('followsFarMore', { followers: 99, following: 200 })).toBeCloseTo(0);
		expect(value('followsFarMore', { followers: 99, following: 1000 })).toBeCloseTo(1);
		expect(value('followsFarMore', { followers: 0, following: 10 })).toBeCloseTo(0.1);
		expect(value('followsFarMore', { followers: 5000, following: 300 })).toBe(0);
	});

	it('digits tail: a long run of digits at the end, and not a year', () => {
		expect(value('digitsTail', { handle: 'ada84620193' })).toBe(1);
		expect(value('digitsTail', { handle: 'ada84620' })).toBe(0.7);
		expect(value('digitsTail', { handle: 'ada1987' })).toBe(0);
		expect(value('digitsTail', { handle: '1234567ada' })).toBe(0);
	});

	it('burst: posts minutes apart, leaving out the pinned one, and nothing with few of them', () => {
		const every = (minutes: number, count: number) =>
			Array.from({ length: count }, (_, i) =>
				post('x', new Date(Date.parse(profile.readAt) - i * minutes * 60_000).toISOString())
			);
		expect(value('burst', { posts: every(2, 8) })).toBeCloseTo(1);
		expect(value('burst', { posts: every(30, 8) })).toBeCloseTo(0);
		expect(value('burst', { posts: every(600, 8) })).toBe(0);
		expect(value('burst', { posts: every(1, 4) })).toBe(0);
		const pinned = post('x', '2020-01-01T00:00:00.000Z', true);
		expect(value('burst', { posts: [pinned, ...every(2, 8)] })).toBeCloseTo(1);
	});

	it('posting rate: from twenty posts a day over its whole life, up to seventy', () => {
		expect(value('postingRate', { created: daysAgo(100), postCount: 2000 })).toBeCloseTo(0);
		expect(value('postingRate', { created: daysAgo(100), postCount: 7000 })).toBeCloseTo(1);
		expect(value('postingRate', { created: daysAgo(0), postCount: 45 })).toBeCloseTo(0.5);
	});

	it('repeats: several posts that say what another says, whatever link, name or number changes', () => {
		const copies = [1, 2, 3, 4, 5, 6, 7].map((n) =>
			post(`Huge news for @user${n}! Claim your ${n}00 tokens now https://example.com/${n}`)
		);
		const others = ['One thing.', 'Another thing.', 'A third thing.'].map((text) => post(text));
		expect(value('repeats', { posts: [...copies, ...others] })).toBeCloseTo(1);
		expect(value('repeats', { posts: [...others, post('A fourth.'), post('A fifth.')] })).toBe(0);
		expect(value('repeats', { posts: copies.slice(0, 3) })).toBe(0);
	});

	it('link heavy: from half the posts with a link out, up to nine in ten', () => {
		const posts = (linked: number) =>
			Array.from({ length: 10 }, (_, n) => post(`Made-up words, ${n}.`, null, false, n < linked));
		expect(value('linkHeavy', { posts: posts(5) })).toBeCloseTo(0);
		expect(value('linkHeavy', { posts: posts(9) })).toBeCloseTo(1);
		expect(value('linkHeavy', { posts: posts(2) })).toBe(0);
	});

	it('hashtag heavy: from two hashtags a post, up to five', () => {
		const posts = (tags: number) =>
			Array.from({ length: 6 }, () => post(`Words ${'#made_up '.repeat(tags)}`));
		expect(value('hashtagHeavy', { posts: posts(2) })).toBeCloseTo(0);
		expect(value('hashtagHeavy', { posts: posts(5) })).toBeCloseTo(1);
	});

	it('say nothing where the page gave no date or no counts', () => {
		const none = { created: null, followers: null, following: null, postCount: null };
		for (const id of ['newAccount', 'oldAccount', 'followsFarMore', 'postingRate']) {
			expect(value(id, none), id).toBe(0);
		}
	});
});
