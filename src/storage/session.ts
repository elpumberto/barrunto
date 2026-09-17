import { storage } from 'wxt/utils/storage';
import type { Answers } from '@/engine';
import { inTurn } from './in-turn';
import type { ConnectionStatus, Counters, Settings } from './types';

// Session storage is wiped when the browser closes. The background opens it to the content script:
// it holds the status, the counters and the answers, never the key or a post's words.

/** How many posts' answers the session keeps before the oldest are dropped. */
export const POSTS_KEPT = 2000;

/** The settings as the content script sees them: a copy the background keeps, since local storage is closed to it. */
export const pageSettings = storage.defineItem<Settings>('session:settings', {
	fallback: { paused: false, sensitivity: 'medium', tuning: false }
});

export const sessionCounters = storage.defineItem<Counters>('session:counters', {
	fallback: { posts: 0, tokensIn: 0, tokensOut: 0 }
});

export const connection = storage.defineItem<ConnectionStatus>('session:connection', {
	fallback: { state: 'noKey' }
});

/** The storage keys of the answers kept, oldest first. */
const answersIndex = storage.defineItem<`session:${string}`[]>('session:answersIndex', {
	fallback: []
});
const answersKey = (postId: string, wording: string) =>
	`session:answers:${wording}:${postId}` as const;

/** Jev's answers about a post to the questions as worded under this name (see the engine's `wordingOf`). */
export const storedAnswers = (postId: string, wording: string) =>
	storage.getItem<Answers>(answersKey(postId, wording));

export function storeAnswers(postId: string, wording: string, answers: Answers): Promise<void> {
	return inTurn(async () => {
		const entry = answersKey(postId, wording);
		const index = [...(await answersIndex.getValue()), entry];
		const dropped = index.splice(0, Math.max(0, index.length - POSTS_KEPT));
		// The index first: cut short here, it names an entry that is not there, which harms nothing;
		// the other way round would leave answers that are never dropped.
		await answersIndex.setValue(index);
		await storage.removeItems(dropped);
		await storage.setItem(entry, answers);
	});
}
