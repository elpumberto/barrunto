import type { Trait } from '@/engine';

/**
 * What is asked of the account as a whole, which no post tells alone: `profile.bio`, which may be
 * empty, against `profile.posts`, the account's own recent posts, and the posts against one
 * another. What kind of thing each post is, is asked post by post: see `kinds.ts`. All of it is
 * about what the account does, which anyone can see, and never about who is behind it.
 */
export const traits: Trait[] = [
	{
		id: 'sameTemplate',
		name: 'same template',
		question:
			'Are most of `profile.posts` one template repeated with small variations: the same structure and phrases with a name, a number, a tag or a link swapped?',
		yes: 'Reading them one after another, they are plainly the same post filled in differently.',
		no: 'Each post is built differently from the others. Sharing a subject or a style is not sharing a template. Fewer than three posts is a no.'
	},
	{
		id: 'asksPrivate',
		name: 'asks for DMs',
		question:
			'Does `profile.bio` or any of `profile.posts` ask readers to get in touch privately: by direct message, WhatsApp, Telegram, email or some other private channel?',
		yes: 'Such as "DM me", "inbox me for details", "message me on WhatsApp", "contact my manager on Telegram".',
		no: 'No such invitation. A public contact for work in a bio, such as a press or business email, is a no.'
	},
	{
		id: 'pressures',
		name: 'pressures',
		question:
			'Do `profile.bio` or `profile.posts` press readers to act quickly: limited spots, a last chance, an offer about to end?',
		yes: 'Such as "only 5 spots left", "last chance", "ends tonight", "do not miss out".',
		no: 'Nothing hurries the reader. A date given for an event or a launch is a no.'
	},
	{
		id: 'bioMismatch',
		name: 'bio mismatch',
		question:
			'Do `profile.posts` clash with `profile.bio`: the bio presents the account as one kind of thing and the posts are plainly another?',
		yes: 'Such as a bio of a nurse and mother with posts that are all about crypto signals, or a bio of a football fan with posts that are all adverts for a betting site.',
		no: 'The posts are what the bio would lead one to expect, or wander as anybody does. An empty bio, or no posts, is a no.'
	},
	{
		id: 'readsGenerated',
		name: 'reads generated',
		question:
			'Do `profile.posts` read as text turned out by a program rather than written by a person: even, polished and hollow, the same length and rhythm again and again, stock openings and closings?',
		yes: 'They are smooth and interchangeable, with no slip, no aside and nothing only this author would say.',
		no: 'They read as written by hand: uneven, particular, with a voice. Careful writing alone is a no.'
	},
	{
		id: 'knowsTheTrade',
		name: 'knows the trade',
		question:
			'Do `profile.posts` show working knowledge of some field: the particulars, the reasons and the experience of somebody who does that work?',
		yes: 'They go into how things are built, run, decided or studied in a field, with detail only practice gives: what was tried, what broke, why one way and not another.',
		no: 'Nothing in them needs knowing a field: daily life, opinions anybody could hold, headlines passed on, slogans. Naming a job in the bio is not showing it in the posts.'
	},
	{
		id: 'talksToPeople',
		name: 'talks to people',
		question:
			'Do any of `profile.posts` answer or address somebody in particular about what that person said or did?',
		yes: 'At least one post takes up what someone else said: it agrees or disagrees with reasons, answers a question, adds to it.',
		no: 'None does, or those that address somebody would fit under anything that person posted.'
	}
];
