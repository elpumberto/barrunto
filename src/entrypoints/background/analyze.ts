import { MatchPattern } from 'wxt/utils/match-patterns';
import { createQueue, strengthsFor, wordingOf } from '@/engine';
import type { Answers, Item, Pack } from '@/engine';
import { jev, JevError } from '@/jev';
import type { Analysis, NotAnalyzed } from '@/messages';
import { packById } from '@/packs';
import { apiKey, connection, countItem, settings, storeAnswers, storedAnswers } from '@/storage';
import type { AnswersOf, ConnectionStatus, Trouble } from '@/storage';

/** How many calls to Jev may be in flight at once. */
const CALLS_IN_FLIGHT = 4;

// The background may be put to sleep at any moment, so nothing that has to last lives in variables.
// These two only matter while calls are in flight, and Chrome keeps the background awake for those.
const queue = createQueue(CALLS_IN_FLIGHT);
const asking = new Map<string, Promise<Asked>>();

type Asked = { answers: Answers } | { failure: NotAnalyzed };

/** Whether the page at this address is one of the pack's. */
const actsOn = (pack: Pack, address: string) =>
	pack.sites.some((site) => new MatchPattern(site).includes(address));

/**
 * The strengths of an item's judgments, asking Jev only if the session has no answers for it yet.
 * `from` is the address of the page that asks: a pack answers only for its own sites, and only while it is on.
 * What is in front of the user is `urgent`, and goes ahead of what is being read ahead of them.
 */
export async function analyze(
	packId: string,
	item: Item,
	from: string,
	urgent = true
): Promise<Analysis> {
	const [key, { paused, packs }, status] = await Promise.all([
		apiKey.getValue(),
		settings.getValue(),
		connection.getValue()
	]);
	if (!key) return { analyzed: false, reason: 'noKey' };
	if (paused) return { analyzed: false, reason: 'paused' };
	if (status.state === 'keyRejected') return { analyzed: false, reason: 'keyRejected' };

	const pack = packById(packId);
	if (!pack || !packs[pack.id]?.enabled || !actsOn(pack, from)) {
		return { analyzed: false, reason: 'packOff' };
	}

	const of = { packId: pack.id, wording: wordingOf(pack.rules.traits), itemId: item.id };
	const stored = await storedAnswers(of);
	const asked: Asked = stored ? { answers: stored } : await askOnce(key, pack, item, of, urgent);
	if ('failure' in asked) return { analyzed: false, reason: asked.failure };
	const { answers } = asked;
	return { analyzed: true, strengths: strengthsFor(pack.rules, answers, item), answers };
}

/**
 * Two askings about the same item at once share a single call: two tabs, or a page that read an
 * item ahead and now has the user in front of it, which hurries the call if it is still waiting.
 */
function askOnce(
	key: string,
	pack: Pack,
	item: Item,
	of: AnswersOf,
	urgent: boolean
): Promise<Asked> {
	const name = `${of.packId}:${of.itemId}`;
	let pending = asking.get(name);
	if (pending && urgent) queue.hurry(name);
	if (!pending) {
		pending = ask(key, pack, item, of, { name, urgent }).finally(() => asking.delete(name));
		asking.set(name, pending);
	}
	return pending;
}

/** Jev's answers, stored and counted; or, if the call fails, the reason, noted in the connection status. */
async function ask(
	key: string,
	{ rules }: Pack,
	item: Item,
	of: AnswersOf,
	turn: { name: string; urgent: boolean }
): Promise<Asked> {
	let asked;
	try {
		asked = await queue.add(() => jev.ask(key, rules.present(item), rules.traits), turn);
	} catch (error) {
		const failure = error instanceof JevError ? error.failure : 'serviceDown';
		if (failure === 'keyRejected') {
			await note(key, { state: 'keyRejected' });
			return { failure };
		}
		// Whatever else went wrong reads as one of the three troubles the popup knows how to tell.
		const reason: Trouble =
			failure === 'tooManyCalls' || failure === 'noNetwork' ? failure : 'serviceDown';
		await note(key, { state: 'trouble', reason });
		return { failure: reason };
	}

	await note(key, { state: 'connected' });
	// Jev has answered and the tokens are spent: trouble keeping the answers does not take the label away.
	await Promise.all([storeAnswers(of, asked.answers), countItem(asked.usage)]).catch((error) =>
		console.error('[barrunto] could not keep the answers', error)
	);
	return { answers: asked.answers };
}

/**
 * Notes how the connection stands after a call. A call can end after the key it went out with
 * was changed or removed, and then it has nothing to say about the connection.
 */
async function note(key: string, status: ConnectionStatus): Promise<void> {
	if ((await apiKey.getValue()) !== key) return;
	const now = await connection.getValue();
	if (JSON.stringify(now) !== JSON.stringify(status)) await connection.setValue(status);
}
