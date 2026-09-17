import { storage } from 'wxt/utils/storage';
import type { Answers } from '@/engine';
import { inTurn } from './in-turn';
import type { ConnectionStatus, Counters, Settings } from './types';

// Session storage is wiped when the browser closes. The background opens it to the content script:
// it holds the status, the counters and the answers, never the key or an item's words.

/** How many items' answers the session keeps before the oldest are dropped. */
export const ITEMS_KEPT = 2000;

/** The settings as the content script sees them: a copy the background keeps, since local storage is closed to it. */
export const pageSettings = storage.defineItem<Settings>('session:settings', {
	fallback: { paused: false, tuning: false, packs: {} }
});

export const sessionCounters = storage.defineItem<Counters>('session:counters', {
	fallback: { items: 0, tokensIn: 0, tokensOut: 0 }
});

export const connection = storage.defineItem<ConnectionStatus>('session:connection', {
	fallback: { state: 'noKey' }
});

/** The storage keys of the answers kept, oldest first. */
const answersIndex = storage.defineItem<`session:${string}`[]>('session:answersIndex', {
	fallback: []
});
/** Whose answers they are: which pack asked, how its questions were worded (see the engine's `wordingOf`) and about which item. */
export interface AnswersOf {
	packId: string;
	wording: string;
	itemId: string;
}
const answersKey = ({ packId, wording, itemId }: AnswersOf) =>
	`session:answers:${packId}:${wording}:${itemId}` as const;

export const storedAnswers = (of: AnswersOf) => storage.getItem<Answers>(answersKey(of));

export function storeAnswers(of: AnswersOf, answers: Answers): Promise<void> {
	return inTurn(async () => {
		const entry = answersKey(of);
		const index = [...(await answersIndex.getValue()), entry];
		const dropped = index.splice(0, Math.max(0, index.length - ITEMS_KEPT));
		// The index first: cut short here, it names an entry that is not there, which harms nothing;
		// the other way round would leave answers that are never dropped.
		await answersIndex.setValue(index);
		await storage.removeItems(dropped);
		await storage.setItem(entry, answers);
	});
}
