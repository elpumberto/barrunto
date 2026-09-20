import type { Judgment, Sensitivity } from '@/engine';
import { labels } from './labels';

/**
 * To speak ill of an account takes more than to speak well of it, and more than to label a post:
 * what is said here is said of somebody, who is there to read it.
 */
const thresholds: Record<Sensitivity, number> = { low: 0.75, medium: 0.55, high: 0.4, ultra: 0.28 };
const kindThresholds: Record<Sensitivity, number> = {
	low: 0.6,
	medium: 0.42,
	high: 0.3,
	ultra: 0.2
};

/** What every judgment that speaks ill of an account is held back by: little to go by. */
const benefitOfTheDoubt: Judgment['recipe'] = [{ kind: 'signal', id: 'fewPosts', weight: -0.25 }];
/** Somebody plainly at their trade is no program and no advert. They may still farm reactions with it, or be after one's money. */
const atTheirTrade: Judgment['recipe'] = [{ kind: 'trait', id: 'knowsTheTrade', weight: -0.2 }];

// The heart of every recipe is how much of what the account posts is of one kind, which Jev tells
// post by post and code counts. What an account is like (how new, what its handle looks like, how
// many it follows) only ever adds to what it does: all of it together stays under the lowest
// threshold. `rules.test.ts` holds that. No two judgments that speak ill of an account count the
// same thing: both would clear at once, and show the same exhibits twice.

const automated: Judgment = {
	id: 'automated',
	recipe: [
		{ kind: 'signal', id: 'stockShare', weight: 0.7 },
		{ kind: 'trait', id: 'sameTemplate', weight: 0.35 },
		{ kind: 'signal', id: 'repeats', weight: 0.35 },
		{ kind: 'trait', id: 'readsGenerated', weight: 0.2 },
		{ kind: 'signal', id: 'burst', weight: 0.2 },
		{ kind: 'signal', id: 'postingRate', weight: 0.15 },
		{ kind: 'signal', id: 'digitsTail', weight: 0.07 },
		{ kind: 'signal', id: 'newAccount', weight: 0.07 },
		{ kind: 'signal', id: 'followsFarMore', weight: 0.07 },
		{ kind: 'signal', id: 'ownShare', weight: -0.4 },
		{ kind: 'signal', id: 'madeShare', weight: -0.3 },
		{ kind: 'trait', id: 'talksToPeople', weight: -0.2 },
		...benefitOfTheDoubt,
		...atTheirTrade
	],
	thresholds,
	label: labels.automated,
	noise: false
};

const scam: Judgment = {
	id: 'scam',
	recipe: [
		{ kind: 'signal', id: 'moneyShare', weight: 0.6 },
		{ kind: 'signal', id: 'moneyPost', weight: 0.35 },
		{ kind: 'trait', id: 'asksPrivate', weight: 0.3 },
		{ kind: 'trait', id: 'bioMismatch', weight: 0.25 },
		{ kind: 'trait', id: 'pressures', weight: 0.2 },
		{ kind: 'signal', id: 'newAccount', weight: 0.07 },
		{ kind: 'signal', id: 'digitsTail', weight: 0.07 },
		{ kind: 'signal', id: 'followsFarMore', weight: 0.07 },
		{ kind: 'signal', id: 'ownShare', weight: -0.2 },
		{ kind: 'signal', id: 'oldAccount', weight: -0.1 },
		...benefitOfTheDoubt
	],
	thresholds,
	label: labels.scam,
	noise: false
};

const billboard: Judgment = {
	id: 'billboard',
	recipe: [
		{ kind: 'signal', id: 'advertShare', weight: 0.85 },
		{ kind: 'signal', id: 'linkHeavy', weight: 0.15 },
		{ kind: 'trait', id: 'pressures', weight: 0.15 },
		{ kind: 'signal', id: 'hashtagHeavy', weight: 0.1 },
		// Showing what one has made is not selling it.
		{ kind: 'signal', id: 'madeShare', weight: -0.4 },
		{ kind: 'signal', id: 'ownShare', weight: -0.3 },
		...benefitOfTheDoubt,
		...atTheirTrade
	],
	thresholds,
	label: labels.billboard,
	noise: false
};

const farm: Judgment = {
	id: 'farm',
	recipe: [
		{ kind: 'signal', id: 'baitShare', weight: 0.7 },
		{ kind: 'signal', id: 'recycledShare', weight: 0.6 },
		{ kind: 'signal', id: 'hashtagHeavy', weight: 0.1 },
		{ kind: 'signal', id: 'ownShare', weight: -0.3 },
		{ kind: 'signal', id: 'madeShare', weight: -0.2 },
		...benefitOfTheDoubt
	],
	thresholds,
	label: labels.farm,
	noise: false
};

// The three that speak well of an account ask for less company than the others: somebody plainly
// telling of their own things, or showing what they make, is enough.

const maker: Judgment = {
	id: 'maker',
	recipe: [
		{ kind: 'signal', id: 'madeShare', weight: 1 },
		{ kind: 'trait', id: 'knowsTheTrade', weight: 0.15 },
		{ kind: 'signal', id: 'ownShare', weight: 0.15 },
		{ kind: 'signal', id: 'advertShare', weight: -0.3 },
		{ kind: 'signal', id: 'recycledShare', weight: -0.3 },
		{ kind: 'signal', id: 'stockShare', weight: -0.2 }
	],
	thresholds: kindThresholds,
	label: labels.maker,
	noise: false
};

const pro: Judgment = {
	id: 'pro',
	recipe: [
		{ kind: 'trait', id: 'knowsTheTrade', weight: 0.65 },
		{ kind: 'signal', id: 'ownShare', weight: 0.15 },
		{ kind: 'signal', id: 'madeShare', weight: 0.15 },
		{ kind: 'trait', id: 'talksToPeople', weight: 0.1 },
		{ kind: 'signal', id: 'oldAccount', weight: 0.1 },
		{ kind: 'signal', id: 'stockShare', weight: -0.3 },
		{ kind: 'signal', id: 'recycledShare', weight: -0.3 },
		{ kind: 'signal', id: 'moneyShare', weight: -0.3 },
		{ kind: 'trait', id: 'readsGenerated', weight: -0.2 }
	],
	thresholds: kindThresholds,
	label: labels.pro,
	noise: false
};

const regular: Judgment = {
	id: 'regular',
	recipe: [
		{ kind: 'signal', id: 'ownShare', weight: 0.7 },
		{ kind: 'signal', id: 'madeShare', weight: 0.4 },
		{ kind: 'trait', id: 'talksToPeople', weight: 0.2 },
		{ kind: 'trait', id: 'knowsTheTrade', weight: 0.1 },
		{ kind: 'signal', id: 'oldAccount', weight: 0.1 },
		{ kind: 'signal', id: 'moneyShare', weight: -0.6 },
		{ kind: 'signal', id: 'stockShare', weight: -0.3 },
		{ kind: 'signal', id: 'advertShare', weight: -0.3 },
		{ kind: 'signal', id: 'recycledShare', weight: -0.3 },
		{ kind: 'trait', id: 'sameTemplate', weight: -0.3 },
		{ kind: 'signal', id: 'baitShare', weight: -0.2 }
	],
	thresholds: kindThresholds,
	label: labels.regular,
	noise: false
};

/** In the order they are told in the catalogue. None is noise: nobody is faded or hidden for what their account looks like. */
export const judgments: Judgment[] = [automated, scam, billboard, farm, maker, pro, regular];
