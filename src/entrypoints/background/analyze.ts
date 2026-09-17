import { createQueue, strengthsFor, wordingOf } from '@/engine';
import type { Answers, Post } from '@/engine';
import { jev, JevError } from '@/jev';
import type { Analysis, NotAnalyzed } from '@/messages';
import { rules } from '@/packs/x/rules';
import { apiKey, connection, countPost, settings, storeAnswers, storedAnswers } from '@/storage';
import type { ConnectionStatus, Trouble } from '@/storage';

/** How many calls to Jev may be in flight at once. */
const CALLS_IN_FLIGHT = 4;

const WORDING = wordingOf(rules.traits);

// The background may be put to sleep at any moment, so nothing that has to last lives in variables.
// These two only matter while calls are in flight, and Chrome keeps the background awake for those.
const queue = createQueue(CALLS_IN_FLIGHT);
const asking = new Map<string, Promise<Asked>>();

type Asked = { answers: Answers } | { failure: NotAnalyzed };

/** The strengths of a post's judgments, asking Jev only if the session has no answers for it yet. */
export async function analyze(post: Post): Promise<Analysis> {
	const [key, { paused }, status] = await Promise.all([
		apiKey.getValue(),
		settings.getValue(),
		connection.getValue()
	]);
	if (!key) return { analyzed: false, reason: 'noKey' };
	if (paused) return { analyzed: false, reason: 'paused' };
	if (status.state === 'keyRejected') return { analyzed: false, reason: 'keyRejected' };

	const stored = await storedAnswers(post.id, WORDING);
	const asked: Asked = stored ? { answers: stored } : await askOnce(key, post);
	if ('failure' in asked) return { analyzed: false, reason: asked.failure };
	const { answers } = asked;
	return { analyzed: true, strengths: strengthsFor(rules, answers, post), answers };
}

/** Two tabs asking about the same post at once share a single call. */
function askOnce(key: string, post: Post): Promise<Asked> {
	let pending = asking.get(post.id);
	if (!pending) {
		pending = ask(key, post).finally(() => asking.delete(post.id));
		asking.set(post.id, pending);
	}
	return pending;
}

/** Jev's answers, stored and counted; or, if the call fails, the reason, noted in the connection status. */
async function ask(key: string, post: Post): Promise<Asked> {
	let asked;
	try {
		asked = await queue.add(() => jev.ask(key, rules.present(post), rules.traits));
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
	await Promise.all([storeAnswers(post.id, WORDING, asked.answers), countPost(asked.usage)]).catch(
		(error) => console.error('[barrunto] could not keep the answers', error)
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
