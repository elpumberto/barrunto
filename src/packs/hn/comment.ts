import type { Item } from '@/engine';

/** What is read of a comment. The id is the number Hacker News gives it. */
export interface Comment extends Item {
	text: string;
	author: string;
	/** How deep in the thread it sits: 0 answers the story itself. */
	depth: number;
	/** What the whole thread hangs from: the story's title and, when it is a text post, its words. */
	story: { title: string; text: string };
	/** The comment this one answers, if it answers one. */
	parent: { author: string; text: string } | null;
}
