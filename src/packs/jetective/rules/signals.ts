import type { PageSignal } from '@/engine';
import type { Profile } from '../profile';
import { most, share } from './kinds';
import type { Kind } from './kinds';

const DAY = 24 * 60 * 60 * 1000;
const YEAR = 365;

/** How long ago the account was opened, in days, where the page says. */
function ageInDays({ created, readAt }: Profile): number | null {
	if (!created) return null;
	const days = (Date.parse(readAt) - Date.parse(created)) / DAY;
	return Number.isFinite(days) ? Math.max(days, 1) : null;
}

/** Opened lately: everything up to a month ago, nothing from a year. */
const newAccount: PageSignal<Profile> = {
	id: 'newAccount',
	name: 'new account',
	from(profile) {
		const days = ageInDays(profile);
		return days === null ? 0 : (YEAR - days) / (YEAR - 30);
	}
};

/** Opened long ago: nothing up to two years, everything from six. */
const oldAccount: PageSignal<Profile> = {
	id: 'oldAccount',
	name: 'old account',
	from(profile) {
		const days = ageInDays(profile);
		return days === null ? 0 : (days / YEAR - 2) / 4;
	}
};

/**
 * Follows far more accounts than follow it: from twice as many, up to ten times. Following a
 * handful says nothing, whoever follows back, so it counts in full only from a hundred.
 */
const followsFarMore: PageSignal<Profile> = {
	id: 'followsFarMore',
	name: 'follows far more',
	from({ followers, following }) {
		if (followers === null || following === null) return 0;
		return ((following / (followers + 1) - 2) / 8) * Math.min(1, following / 100);
	}
};

/**
 * The handle ends in a run of digits, as the ones X.com makes up for whoever does not choose one.
 * Four may be a year, and count for nothing.
 */
const digitsTail: PageSignal<Profile> = {
	id: 'digitsTail',
	name: 'digits tail',
	from({ handle }) {
		const digits = handle.match(/\d*$/)![0].length;
		return digits >= 6 ? 1 : digits === 5 ? 0.7 : 0;
	}
};

/** With fewer dated posts than this, the time between them says nothing. */
const FEWEST_DATED = 5;

/**
 * The posts on the page come minutes apart: from half an hour between one and the next, as the
 * middle one of the gaps, down to two minutes. A pinned post is out of order, and left out.
 */
const burst: PageSignal<Profile> = {
	id: 'burst',
	name: 'burst',
	from({ posts }) {
		const times = posts
			.filter((post) => !post.pinned && post.at)
			.map((post) => Date.parse(post.at!))
			.filter(Number.isFinite)
			.sort((a, b) => a - b);
		if (times.length < FEWEST_DATED) return 0;
		const gaps = times.slice(1).map((time, i) => (time - times[i]!) / 60_000);
		gaps.sort((a, b) => a - b);
		const middle = gaps[Math.floor(gaps.length / 2)]!;
		return (30 - middle) / 28;
	}
};

/** Posts a day over the account's whole life: from twenty, up to seventy. */
const postingRate: PageSignal<Profile> = {
	id: 'postingRate',
	name: 'posting rate',
	from(profile) {
		const days = ageInDays(profile);
		if (days === null || profile.postCount === null) return 0;
		return (profile.postCount / days - 20) / 50;
	}
};

/** With fewer posts than this on the page, what share of them does something says nothing. */
const FEWEST_TO_COUNT = 4;

/** What a post says, without what changes from one copy of it to the next: links, names, numbers, signs. */
const gist = (text: string) =>
	text
		.toLowerCase()
		.replace(/https?:\/\/\S+|[@#]\w+|\d+/g, ' ')
		.replace(/[^\p{L}\s]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 60);

/** The same post again and again: from one in five of the posts on the page saying what another says, up to seven in ten. */
const repeats: PageSignal<Profile> = {
	id: 'repeats',
	name: 'repeats',
	from({ posts }) {
		if (posts.length < FEWEST_TO_COUNT) return 0;
		const times = new Map<string, number>();
		for (const post of posts) times.set(gist(post.text), (times.get(gist(post.text)) ?? 0) + 1);
		const repeated = posts.filter((post) => gist(post.text) && times.get(gist(post.text))! > 1);
		return (repeated.length / posts.length - 0.2) / 0.5;
	}
};

/** Nearly every post carries a link out: from half of them, up to nine in ten. */
const linkHeavy: PageSignal<Profile> = {
	id: 'linkHeavy',
	name: 'link heavy',
	from({ posts }) {
		if (posts.length < FEWEST_TO_COUNT) return 0;
		return (posts.filter((post) => post.hasLink).length / posts.length - 0.5) / 0.4;
	}
};

/** Posts loaded with hashtags: from two a post on average, up to five. */
const hashtagHeavy: PageSignal<Profile> = {
	id: 'hashtagHeavy',
	name: 'hashtag heavy',
	from({ posts }) {
		if (posts.length < FEWEST_TO_COUNT) return 0;
		const tags = posts.reduce((sum, post) => sum + (post.text.match(/#\w+/g)?.length ?? 0), 0);
		return (tags / posts.length - 2) / 3;
	}
};

/**
 * Little to go by: everything with four posts or fewer, nothing from twelve. It holds back every
 * judgment that speaks ill of an account: a few posts that look alike are not a habit.
 */
const fewPosts: PageSignal<Profile> = {
	id: 'fewPosts',
	name: 'few posts',
	from: ({ posts }) => (12 - posts.length) / 8
};

/** How much of what the account posts is of each kind, as Jev took its posts one by one. Nothing until it has answered. */
const shareOf = (kind: Kind, name: string): PageSignal<Profile> => ({
	id: `${kind}Share`,
	name,
	from: (profile, answers = {}) => share(kind, profile, answers)
});

/** One post that plainly promises money is a thing by itself, among however many that do not. */
const moneyPost: PageSignal<Profile> = {
	id: 'moneyPost',
	name: 'a money post',
	from: (profile, answers = {}) => (most('money', profile, answers) - 0.5) / 0.4
};

export const signals: PageSignal<Profile>[] = [
	newAccount,
	oldAccount,
	followsFarMore,
	digitsTail,
	burst,
	postingRate,
	repeats,
	linkHeavy,
	hashtagHeavy,
	fewPosts,
	shareOf('own', 'own posts'),
	shareOf('made', 'made posts'),
	shareOf('stock', 'stock posts'),
	shareOf('advert', 'advert posts'),
	shareOf('money', 'money posts'),
	shareOf('bait', 'bait posts'),
	shareOf('recycled', 'recycled posts'),
	moneyPost
];
