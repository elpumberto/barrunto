import { describe, expect, it } from 'vitest';
import { labelsFor, strengthsFor } from '@/engine';
import type { Answers, Sensitivity } from '@/engine';
import type { Profile } from '../profile';
import { account, answersFor, posts, yearsAgo } from './made-up';
import { rules } from '.';

/**
 * The kinds of account each recipe is meant for, with the answers one would expect of Jev for them:
 * what kind each post is, and what it said of the account as a whole. They say what the recipes
 * intend. The weights had a first tuning against real profiles, and are there to be moved.
 */
const labels = (p: Profile, a: Answers, sensitivity: Sensitivity) =>
	labelsFor(rules.judgments, strengthsFor(rules, a, p), sensitivity).map((j) => j.id);

describe('the recipes', () => {
	it('takes stock replies by the dozen from a new handle full of digits for Automated, even on low', () => {
		const bot = account({
			handle: 'ada84620193',
			created: yearsAgo(0.05),
			followers: 12,
			following: 900,
			posts: posts(14, 2)
		});
		expect(labels(bot, answersFor(bot, { stock: 13 }), 'low')).toEqual(['automated']);
	});

	it('takes the same post over and over for Automated', () => {
		const copies = account({
			posts: posts(14).map((post) => ({ ...post, text: 'Claim your tokens now!' }))
		});
		const a = answersFor(copies, { advert: 6 }, { sameTemplate: 0.9, readsGenerated: 0.8 });
		expect(labels(copies, a, 'medium')).toContain('automated');
	});

	it('does not take a new account with a handle full of digits for anything, on that alone', () => {
		const fresh = account({ handle: 'ada84620193', created: yearsAgo(0.05), postCount: 40 });
		expect(labels(fresh, answersFor(fresh), 'ultra')).toEqual([]);
	});

	it('does not take somebody who answers people briefly now and then for Automated', () => {
		const brief = account();
		const a = answersFor(brief, { stock: 4, own: 8 }, { talksToPeople: 0.7 });
		expect(labels(brief, a, 'high')).toEqual(['regular']);
	});

	it('does not take someone who posts a lot, about their own things, for Automated', () => {
		const chatty = account({ posts: posts(14, 3), postCount: 60_000 });
		const a = answersFor(chatty, { own: 12 }, { talksToPeople: 0.8 });
		expect(labels(chatty, a, 'high')).toEqual(['regular']);
	});

	it('takes posts that promise returns and "DM me" for Scam, even on low', () => {
		const pitch = account({ created: yearsAgo(0.2) });
		const a = answersFor(pitch, { money: 10 }, { asksPrivate: 0.9, pressures: 0.7 });
		expect(labels(pitch, a, 'low')).toEqual(['scam']);
	});

	it('takes one plain promise of money among other things, with a request to write in private, for Scam', () => {
		const a = answersFor(account(), { money: 2, own: 4 }, { asksPrivate: 0.95, bioMismatch: 0.8 });
		expect(labels(account(), a, 'medium')).toContain('scam');
	});

	it('does not take a shop that asks for DMs to order for Scam', () => {
		const shop = account();
		const a = answersFor(shop, { advert: 11, own: 3 }, { asksPrivate: 0.9 });
		expect(labels(shop, a, 'medium')).toEqual(['billboard']);
	});

	it('takes an account that is one advert after another for Billboard', () => {
		const adverts = account({ posts: posts(14).map((post) => ({ ...post, hasLink: true })) });
		const a = answersFor(adverts, { advert: 13 }, { pressures: 0.6 });
		expect(labels(adverts, a, 'low')).toEqual(['billboard']);
	});

	it('takes somebody who shows what they make for Maker, and not for Billboard, links and all', () => {
		const builder = account({
			created: yearsAgo(0.02),
			followers: 3,
			following: 34,
			posts: posts(6).map((post) => ({ ...post, hasLink: true }))
		});
		// As Jev answered about a real account of this kind, with six posts on the page.
		const a = answersFor(
			builder,
			{ made: 4, stock: 2 },
			{ knowsTheTrade: 0.77, talksToPeople: 0.62 }
		);
		expect(labels(builder, a, 'low')).toEqual(['maker']);
		expect(labels(builder, a, 'medium')).toEqual(['maker', 'pro']);
	});

	it('takes quotes that go round and "follow for more" for Farm', () => {
		const farm = account();
		expect(labels(farm, answersFor(farm, { bait: 7, recycled: 6 }), 'medium')).toEqual(['farm']);
		expect(labels(farm, answersFor(farm, { recycled: 5, own: 6 }), 'medium')).toEqual([]);
	});

	it('takes someone who goes into their field as one who works in it for Pro, and for Regular with it', () => {
		const old = account({ created: yearsAgo(8) });
		const a = answersFor(old, { own: 10 }, { knowsTheTrade: 0.9, talksToPeople: 0.6 });
		expect(labels(old, a, 'medium')).toEqual(['pro', 'regular']);
	});

	it('does not take tips that go round, however expert they sound, for Pro', () => {
		const tips = account();
		const a = answersFor(
			tips,
			{ recycled: 8, bait: 5 },
			{ knowsTheTrade: 0.7, readsGenerated: 0.7 }
		);
		expect(labels(tips, a, 'medium')).toEqual(['farm']);
	});

	it('takes someone telling of their own things for Regular, and more so on an old account', () => {
		const a = (p: Profile) => answersFor(p, { own: 11 }, { talksToPeople: 0.7 });
		const old = account({ created: yearsAgo(9) });
		expect(labels(old, a(old), 'low')).toEqual(['regular']);
		const newer = account({ created: yearsAgo(1) });
		expect(labels(newer, a(newer), 'medium')).toEqual(['regular']);
	});

	it('does not take a voice of their own for Regular when post after post promises money', () => {
		const a = answersFor(account(), { money: 8, own: 5 }, { asksPrivate: 0.9 });
		expect(labels(account(), a, 'medium')).toEqual(['scam']);
	});

	it('takes more to speak ill of an account that has shown few posts', () => {
		const few = account({ posts: posts(5) });
		const many = account({ posts: posts(14) });
		expect(labels(many, answersFor(many, { advert: 10 }), 'medium')).toEqual(['billboard']);
		expect(labels(few, answersFor(few, { advert: 3, other: 2 }), 'medium')).toEqual([]);
		// Every one of the few being of a kind is still something.
		expect(labels(few, answersFor(few, { advert: 5 }), 'medium')).toEqual(['billboard']);
	});

	it('charges no two things on the same exhibits', () => {
		const ill = rules.judgments.filter((j) => j.thresholds.low > 0.7);
		expect(ill.map((j) => j.id)).toEqual(['automated', 'scam', 'billboard', 'farm']);
		const pushing = ill.flatMap((j) => j.recipe.filter((i) => i.weight >= 0.1).map((i) => i.id));
		const shared = pushing.filter((id, n) => pushing.indexOf(id) !== n);
		// Hurrying the reader is what both a scam and a hard sell do, and so is loading posts with hashtags.
		expect(shared).toEqual(['pressures', 'hashtagHeavy']);
	});

	it('says nothing of an account Jev could tell nothing about', () => {
		expect(labels(account(), answersFor(account()), 'high')).toEqual([]);
		const none = account({ posts: [] });
		expect(labels(none, answersFor(none, {}, { knowsTheTrade: 0.5 }), 'medium')).toEqual([]);
	});
});
