import { MatchPattern } from 'wxt/utils/match-patterns';
import { createQueue, strengthsFor, wordingOf } from '@/engine';
import type { Answers, Item, Pack, Presented } from '@/engine';
import { jev, JevError } from '@/jev';
import type { Analysis, NotAnalyzed } from '@/messages';
import { packById } from '@/packs';
import { apiKey, connection, countItem, settings, storeAnswers, storedAnswers } from '@/storage';
import type { AnswersOf, ConnectionStatus, Trouble } from '@/storage';
import { takingTurns } from '@/storage/in-turn';

/** How many calls to Jev may be in flight at once. */
const CALLS_IN_FLIGHT = 4;

// The background may be put to sleep at any moment, so nothing that has to last lives in variables.
// These only matter while calls are in flight or waiting, and Chrome keeps the background awake
// while a page waits for its reply.
const queue = createQueue(CALLS_IN_FLIGHT);
const asking = new Map<string, Promise<Asked>>();
const notingInTurn = takingTurns();
/** Calls are numbered as they go out, so that one that ends late says nothing over a later one. */
let callsMade = 0;
let lastNoted = 0;

type Asked = { answers: Answers } | { failure: NotAnalyzed };

/** A call that was waiting its turn when what it was for stopped being wanted. */
class NoLongerWanted extends Error {
	constructor(readonly reason: NotAnalyzed) {
		super(reason);
	}
}

/** Whether the page at this address is one of the pack's. */
const actsOn = (pack: Pack, address: string) =>
	pack.sites.some((site) => new MatchPattern(site).includes(address));

/** Why nothing is to be asked of Jev with this key for this pack right now, if there is a reason. */
async function whyNot(key: string | null, packId: string): Promise<NotAnalyzed | null> {
	const [stored, { paused, packs }, status] = await Promise.all([
		apiKey.getValue(),
		settings.getValue(),
		connection.getValue()
	]);
	if (!stored || (key !== null && stored !== key)) return 'noKey';
	if (paused) return 'paused';
	if (status.state === 'keyRejected') return 'keyRejected';
	if (!packs[packId]?.enabled) return 'packOff';
	return null;
}

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
	const reason = await whyNot(null, packId);
	if (reason) return { analyzed: false, reason };
	const pack = packById(packId);
	if (!pack || !actsOn(pack, from)) return { analyzed: false, reason: 'packOff' };
	const key = (await apiKey.getValue())!;

	// The item comes from a page, as plain data that nobody has checked against its pack's shape:
	// what its pack cannot make sense of is the item's fault, not Jev's.
	const malformed = (error: unknown): Analysis => {
		console.error('[barrunto] could not make sense of an item', error);
		return { analyzed: false, reason: 'malformed' };
	};
	let presented;
	try {
		presented = pack.rules.present(item);
	} catch (error) {
		return malformed(error);
	}

	const of = { packId: pack.id, wording: wordingOf(pack.rules.traits), itemId: String(item.id) };
	const stored = await storedAnswers(of);
	const asked: Asked = stored
		? { answers: stored }
		: await askOnce(key, pack, presented, of, urgent);
	if ('failure' in asked) return { analyzed: false, reason: asked.failure };
	const { answers } = asked;
	try {
		return { analyzed: true, strengths: strengthsFor(pack.rules, answers, item), answers };
	} catch (error) {
		return malformed(error);
	}
}

/**
 * Two askings about the same item at once share a single call: two tabs, or a page that read an
 * item ahead and now has the user in front of it, which hurries the call if it is still waiting.
 */
function askOnce(
	key: string,
	pack: Pack,
	presented: Presented,
	of: AnswersOf,
	urgent: boolean
): Promise<Asked> {
	const name = `${of.packId}:${of.itemId}`;
	let pending = asking.get(name);
	if (pending && urgent) queue.hurry(name);
	if (!pending) {
		pending = ask(key, pack, presented, of, { name, urgent }).finally(() => asking.delete(name));
		asking.set(name, pending);
	}
	return pending;
}

/** Jev's answers, stored and counted; or, if the call fails, the reason, noted in the connection status. */
async function ask(
	key: string,
	{ id, rules }: Pack,
	presented: Presented,
	of: AnswersOf,
	turn: { name: string; urgent: boolean }
): Promise<Asked> {
	let asked;
	let call = 0;
	try {
		asked = await queue.add(async () => {
			// It may have waited long for its turn: a pause, a key removed or a pack turned off
			// meanwhile stops it here, before anything is sent or spent.
			const reason = await whyNot(key, id);
			if (reason) throw new NoLongerWanted(reason);
			call = ++callsMade;
			return jev.ask(key, presented, rules.traits);
		}, turn);
	} catch (error) {
		if (error instanceof NoLongerWanted) return { failure: error.reason };
		const failure = error instanceof JevError ? error.failure : 'serviceDown';
		if (failure === 'keyRejected') {
			await note(call, key, { state: 'keyRejected' });
			return { failure };
		}
		// Whatever else went wrong reads as one of the three troubles the popup knows how to tell.
		const reason: Trouble =
			failure === 'tooManyCalls' || failure === 'noNetwork' ? failure : 'serviceDown';
		await note(call, key, { state: 'trouble', reason });
		return { failure: reason };
	}

	await note(call, key, { state: 'connected' });
	// Jev has answered and the tokens are spent: trouble keeping the answers does not take the label away.
	await Promise.all([storeAnswers(of, asked.answers), countItem(asked.usage)]).catch((error) =>
		console.error('[barrunto] could not keep the answers', error)
	);
	return { answers: asked.answers };
}

/**
 * Notes how the connection stands after a call. A call can end after the key it went out with was
 * changed or removed, or after a later call has already ended: then it has nothing to say.
 */
function note(call: number, key: string, status: ConnectionStatus): Promise<void> {
	return notingInTurn(async () => {
		if (call < lastNoted || (await apiKey.getValue()) !== key) return;
		lastNoted = call;
		const now = await connection.getValue();
		if (JSON.stringify(now) !== JSON.stringify(status)) await connection.setValue(status);
	});
}
