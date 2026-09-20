import type { CardTexts, Counted } from '@/engine';
import type { Profile } from './profile';
import { count as countOf } from './rules/kinds';
import type { Kind } from './rules/kinds';

/**
 * The words of the case file. Every line of it is one of these, picked by code from what Jev
 * answered and what the page says: nothing is written for the occasion. A charge says what the
 * account looks like, never what it is.
 */

const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December'
];
const DAY = 24 * 60 * 60 * 1000;
const NOT_SAID = 'not on the page';

const count = (n: number | null) => (n === null ? NOT_SAID : n.toLocaleString('en-US'));
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "March 2019 · 6 years": the month the account was opened, and how long ago that is. */
function onFileSince({ created, readAt }: Profile): string {
	if (!created) return NOT_SAID;
	const opened = new Date(created);
	const days = (Date.parse(readAt) - opened.getTime()) / DAY;
	const age =
		days < 31
			? plural(Math.max(1, Math.floor(days)), 'day')
			: days < 365
				? plural(Math.floor(days / 30.4), 'month')
				: plural(Math.floor(days / 365), 'year');
	return `${MONTHS[opened.getUTCMonth()]} ${opened.getUTCFullYear()} · ${age}`;
}

/** "1,306 · about 0.5 a day", over the account's whole life. */
function postsOnRecord({ postCount, created, readAt }: Profile): string {
	if (postCount === null) return NOT_SAID;
	if (!created) return count(postCount);
	const days = Math.max(1, (Date.parse(readAt) - Date.parse(created)) / DAY);
	const aDay = postCount / days;
	return `${count(postCount)} · about ${aDay < 10 ? aDay.toFixed(1) : Math.round(aDay)} a day`;
}

/** "7 of 12 posts read as adverts.": what Jev said of the posts one by one, counted, for a reader to check. */
const counted = (kind: Kind, what: string): Counted<Profile> => ({
	say(profile, answers) {
		const { of, all } = countOf(kind, profile, answers);
		// A little of a kind spread over many posts may weigh with none of them being of it: nothing to tell.
		return of ? `${of} of ${all} posts ${what}.` : '';
	}
});

/**
 * A number that is always the same for the same account, and says nothing of it. Worked out here:
 * this half of a pack is read when the extension is built, too, where only the engine's types are at hand.
 */
function caseNumber(handle: string): string {
	let sum = 7;
	for (const letter of handle) sum = (Math.imul(sum, 31) + letter.charCodeAt(0)) >>> 0;
	return sum.toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

export const card: CardTexts<Profile> = {
	letterhead: 'Jetective Jev · Bureau of Hunches',
	signature: 'J. Jev, jetective on the case',
	title: ({ handle }) => `Case Nº JJ-${caseNumber(handle)}`,
	stamps: { asking: 'Under inquiry', charged: 'Hunch', clear: 'No charges' },
	subject: 'Subject',
	facts: (profile) => [
		{ name: 'Alias', value: profile.name },
		{ name: 'Handle', value: `@${profile.handle}` },
		{ name: 'On file since', value: onFileSince(profile) },
		{ name: 'Follows', value: count(profile.following) },
		{ name: 'Followed by', value: count(profile.followers) },
		{ name: 'Posts on record', value: postsOnRecord(profile) },
		{
			name: 'Examined',
			value: `${profile.bio ? 'the bio and ' : ''}${plural(profile.posts.length, 'post')} on this page`
		}
	],
	findings: 'Findings',
	asking: 'Jetective Jev is on the case: going through the bio and the posts…',
	nothing: 'Nothing clear on this account. No charges.',
	caveat:
		'A hunch drawn from what this page shows, not a verdict. It says what the account looks like, never who is behind it.',
	charges: {
		automated: 'Looks like an automated account',
		scam: 'Looks like a scam',
		billboard: 'Looks like a billboard',
		farm: 'Looks like a farm of reactions',
		maker: 'Looks like somebody who makes things and shows them',
		pro: 'Looks like somebody who knows their trade',
		regular: "Looks like somebody's own account"
	},
	hunches: { faint: 'a faint hunch', fair: 'a fair hunch', strong: 'a strong hunch' },
	pushed: 'Exhibits for',
	heldBack: 'Exhibits against',
	none: 'Nothing on file.',
	evidence: {
		sameTemplate: 'Its posts are one template, filled in again and again.',
		asksPrivate: 'Asks to be written to in private.',
		pressures: 'Hurries the reader: few spots, last chances.',
		bioMismatch: 'The bio says one thing and the posts another.',
		readsGenerated: 'The posts read as turned out by a program.',
		knowsTheTrade: 'Goes into a field as somebody who works in it.',
		talksToPeople: 'Answers what others actually said.',
		ownShare: counted('own', 'tell of things of their own, in words of their own'),
		madeShare: counted('made', 'show something the author made'),
		stockShare: counted('stock', 'would fit under any post'),
		advertShare: counted('advert', 'read as adverts'),
		moneyShare: counted('money', 'promise money, or to get back what was lost'),
		baitShare: counted('bait', 'ask to be liked, answered or followed'),
		recycledShare: counted('recycled', 'are stock material that goes round'),
		moneyPost: 'One post plainly promises money, or to get back what was lost.',
		newAccount: 'The account was opened not long ago.',
		oldAccount: 'The account has been around for years.',
		followsFarMore: 'Follows far more accounts than follow it.',
		digitsTail: 'The handle ends in a long run of digits.',
		burst: 'The posts on the page came minutes apart.',
		postingRate: 'Has posted more in a day, on average, than is kept up by hand.',
		repeats: 'Several posts on the page say the same as another.',
		linkHeavy: 'Nearly every post carries a link out.',
		hashtagHeavy: 'The posts are loaded with hashtags.',
		fewPosts: 'Few posts examined: little to go by.'
	}
};
