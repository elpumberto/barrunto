import { browser } from 'wxt/browser';
import type { Answers, Post, Strengths } from '@/engine';
import type { Trouble } from '@/storage/types';

/** What the parts of the extension ask the background, and what each gets back. */
interface Messages {
	analyzePost: { carries: { post: Post }; returns: Analysis };
	checkKey: { carries: { apiKey: string }; returns: KeyCheck };
	forgetKey: { carries: object; returns: void };
	resetCounters: { carries: object; returns: void };
}

/** Only the X.com page asks for analyses; everything else is the popup's to ask. */
const FROM_THE_PAGE: MessageType[] = ['analyzePost'];
const PAGE = 'https://x.com/';

/** Why the background did not analyze a post it was asked about. */
export type NotAnalyzed = 'noKey' | 'paused' | 'keyRejected' | Trouble;

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
type Handlers = { [T in MessageType]: (message: Message<T>) => Promise<Reply<T>> };

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
		const handler = handlers[message?.type] as ((m: Message) => Promise<unknown>) | undefined;
		if (!handler || sender.id !== browser.runtime.id) return;

		// A content script's messages carry the address of its page; the popup's, the extension's own.
		const from = FROM_THE_PAGE.includes(message.type) ? PAGE : browser.runtime.getURL('/');
		if (!sender.url?.startsWith(from)) return;

		handler(message).then(reply, (error) => {
			console.error('[barrunto]', error);
			reply(undefined);
		});
		// Keeps the channel open for the reply, which comes later.
		return true;
	});
}
