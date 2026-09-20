import type { Item } from '@/engine';

/**
 * What is read of an account from its profile page. The id is its handle, in lower case, and a
 * number that changes with the posts read: Jev answers about each of them. Of all this, Jev is
 * shown the name, the bio and the words of the posts: the rest is for the page signals.
 */
export interface Profile extends Item {
	/** Without the "@". */
	handle: string;
	name: string;
	bio: string;
	/** The account's own posts that the page has shown, in the order it showed them. */
	posts: ProfilePost[];
	/** When the account was opened, as an ISO date, where the page says. */
	created: string | null;
	/** Its counts, where the page says. */
	followers: number | null;
	following: number | null;
	postCount: number | null;
	/** When the page was read, as an ISO date: how old an account is depends on the day. */
	readAt: string;
}

/** No account needs more of its posts than this to be judged, and each of them is a question to Jev. */
export const MOST_POSTS = 30;

export interface ProfilePost {
	/** The number X.com gives it, or its words where the page does not say. */
	id: string;
	text: string;
	/** When it was posted, as an ISO date. */
	at: string | null;
	/** Kept at the top by its author, out of the order of the rest. */
	pinned: boolean;
	/** Whether it carries a link out of X.com, in its words or as a card under them. */
	hasLink: boolean;
}
