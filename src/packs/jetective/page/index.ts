import type { CardHalf } from '@/engine';
import type { Profile } from '../profile';
import { profileAt } from './address';
import { MOST_POSTS } from '../profile';
import { cardAnchor, readProfile } from './read';

/** With this many of its posts on the page there is enough to go by, without waiting for more. */
const POSTS_ENOUGH = 5;
/** This many more posts than were asked about are worth another look: about as many as the page shows at a time. */
const MORE_POSTS_FOR_ANOTHER_LOOK = 6;
/** A bio shorter than this, with no posts, says nothing worth a call. */
const SHORTEST_BIO = 20;

export const page: CardHalf<Profile> = {
	subjectOf: profileAt,
	read: readProfile,
	// The header of a profile is drawn before its posts: a few of them are waited for.
	ready: ({ posts, bio }, settled) =>
		posts.length >= POSTS_ENOUGH || (settled && (posts.length > 0 || bio.length >= SHORTEST_BIO)),
	// The user has gone down the profile, and the page has shown a good few more posts than were
	// asked about: worth another look, until Jev has been shown as many as it ever is.
	// So is a first look that came before the posts did, as soon as there are any more.
	again: ({ posts }, asked) =>
		asked.posts.length < MOST_POSTS &&
		(asked.posts.length < POSTS_ENOUGH
			? posts.length > asked.posts.length
			: posts.length >= Math.min(MOST_POSTS, asked.posts.length + MORE_POSTS_FOR_ANOTHER_LOOK)),
	anchor: cardAnchor
};
