import type { Item } from '@/engine';

/** What is read of a post. The id is the number X.com gives it, which sits in its link. */
export interface Post extends Item {
	text: string;
	author: { name: string; handle: string };
	metrics: Metrics;
	hasMedia: boolean;
	hasLink: boolean;
	inThread: boolean;
	/** Whether the page shows only the beginning of the text. */
	isCutShort: boolean;
	/** The post this one quotes, if it quotes one. */
	quoted: { author: string; text: string } | null;
}

export interface Metrics {
	replies: number;
	reposts: number;
	likes: number;
}
