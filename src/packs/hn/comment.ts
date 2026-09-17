import type { Item } from '@/engine';

/**
 * What is read of a comment. The id is the number Hacker News gives it. Who wrote it, and who wrote
 * what it answers, are left on the page: no question is about them, so they have no business leaving it.
 */
export interface Comment extends Item {
	text: string;
	/** What the whole thread hangs from: the story's title and, when it is a text post, its words. */
	story: { title: string; text: string };
	/** The comment this one answers, if it answers one. */
	parent: { text: string } | null;
}
