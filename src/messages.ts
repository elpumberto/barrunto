import { browser } from 'wxt/browser';
import type { Answers, Item, Strengths } from '@/engine';
import type { Trouble } from '@/storage/types';

/** What the parts of the extension ask the background, and what each gets back. */
interface Messages {
	/** `urgent`: the item is in front of the user, and not one read ahead of them. */
	analyze: { carries: { packId: string; item: Item; urgent: boolean }; returns: Analysis };
	checkKey: { carries: { apiKey: string }; returns: KeyCheck };
	forgetKey: { carries: object; returns: void };
	resetCounters: { carries: object; returns: void };
}

/** Only a page asks for analyses; everything else is for Barrunto's own pages to ask. */
const FROM_A_PAGE: MessageType[] = ['analyze'];

/**
 * Why the background did not analyze an item it was asked about. `packOff`: that pack is not on for
 * that page. `malformed`: the item is not one its pack can make sense of.
 */
export type NotAnalyzed = 'noKey' | 'paused' | 'keyRejected' | 'packOff' | 'malformed' | Trouble;

/** The strengths and, for tuning mode, the answers; or that it was not analyzed, and why. */
export type Analysis =
	| { analyzed: true; strengths: Strengths; answers: Answers }
	| { analyzed: false; reason: NotAnalyzed };

/** Why a key did not pass its test call. */
export type KeyFailure = 'keyRejected' | 'serviceDown' | 'noNetwork';
export type KeyCheck = { ok: true } | { ok: false; failure: KeyFailure };

type MessageType = keyof Messages;
type Message<T extends MessageType = MessageType> = { type: T } & Messages[T]['carries'];
type Reply<T extends MessageType> = Messages[T]['returns'];
/** Each handler gets the message and the address of the page it came from. */
type Handlers = { [T in MessageType]: (message: Message<T>, from: string) => Promise<Reply<T>> };

/**
 * Resolves with the background's reply, or with nothing if the background failed to answer.
 * Rejects when there is no background to ask: the extension was reloaded under a page still open.
 */
export async function send<T extends MessageType>(
	message: Message<T>
): Promise<Reply<T> | undefined> {
	return browser.runtime.sendMessage(message);
}

/** For the background: answers each message with its handler, if it comes from where it should. */
export function listen(handlers: Handlers): void {
	browser.runtime.onMessage.addListener((message: Message, sender, reply) => {
		// Only what is listed is answered: not what every object has besides, such as `toString`.
		const known = message != null && Object.hasOwn(handlers, message.type);
		const handler = (known ? handlers[message.type] : undefined) as
			((m: Message, from: string) => Promise<unknown>) | undefined;
		if (!handler || sender.id !== browser.runtime.id || !sender.url) return;

		// A content script's messages carry the address of its page; those of Barrunto's own pages,
		// the extension's. Which pages may ask for an analysis is for its handler to say.
		const ownPage = sender.url.startsWith(browser.runtime.getURL('/'));
		if (ownPage === FROM_A_PAGE.includes(message.type)) return;

		handler(message, sender.url).then(reply, (error) => {
			console.error('[barrunto]', error);
			reply(undefined);
		});
		// Keeps the channel open for the reply, which comes later.
		return true;
	});
}
