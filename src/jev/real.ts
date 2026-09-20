import {
	APIConnectionError,
	APIError,
	AuthenticationError,
	choice,
	noul,
	PermissionDeniedError,
	RateLimitError,
	TypeSafeClient
} from '@typesafe-ai/sdk';
import type { Questions, TypeSafeClientConfig } from '@typesafe-ai/sdk';
import type { Answers } from '@/engine';
import { JevError } from './types';
import type { Jev, JevFailure } from './types';

/** The SDK's errors, reduced to the short list the rest of Barrunto knows. */
function failureOf(error: unknown): JevFailure {
	if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
		return 'keyRejected';
	}
	if (error instanceof RateLimitError) return 'tooManyCalls';
	// A call that times out is one of these too.
	if (error instanceof APIConnectionError) return 'noNetwork';
	return 'serviceDown';
}

/**
 * A request Jev could not make sense of is a fault of Barrunto's, and worth seeing. Never the body:
 * it may echo a post. Everything else is no fault of the code: a key turned down, too many calls,
 * a network that drops or Jev failing. The popup tells of those, and Chrome would list them among
 * the extension's errors, where they read as the extension being broken.
 */
function report(error: unknown): void {
	if (!(error instanceof APIError) || error instanceof APIConnectionError) return;
	if (error.status >= 500 || failureOf(error) !== 'serviceDown') return;
	console.error('[barrunto] Jev:', error.status, error.message);
}

/** Jev through TypeSafe's SDK. `config` is for the tests, which bring their own `fetch`. */
export function createJev(config: TypeSafeClientConfig = {}): Jev {
	let client: { apiKey: string; sdk: TypeSafeClient } | undefined;

	function clientFor(apiKey: string): TypeSafeClient {
		if (!apiKey) throw new JevError('noKey');
		if (client?.apiKey !== apiKey) {
			// The SDK refuses to run in a browser, so that nobody ships a website with their key inside.
			// Here the key is the user's own and never leaves their browser.
			const sdk = new TypeSafeClient({ ...config, apiKey, dangerouslyAllowBrowser: true });
			client = { apiKey, sdk };
		}
		return client.sdk;
	}

	return {
		async ask(apiKey, content, traits) {
			const sdk = clientFor(apiKey);
			const questions: Questions = {};
			for (const { id, question, yes, no, options } of traits) {
				questions[id] = options
					? choice(question, options)
					: noul(question, yes || no ? { true: yes, false: no } : undefined);
			}
			let result;
			try {
				result = await sdk.systemOne({ state: content, questions });
			} catch (error) {
				report(error);
				throw new JevError(failureOf(error));
			}

			const answers: Answers = {};
			for (const { id, options } of traits) {
				const answer = result.answers[id];
				// An answer that is missing is not a no: better no answers than made-up ones kept for the session.
				if (answer?.type !== (options ? 'choice' : 'noul')) throw new JevError('serviceDown');
				if (answer.type === 'noul') answers[id] = answer.noul;
				if (answer.type === 'choice') {
					for (const option of Object.keys(options!)) {
						const chance = answer.probabilities[option];
						// Jev gives every option its chance: one that is missing is no answer, and not a zero.
						if (typeof chance !== 'number') throw new JevError('serviceDown');
						answers[`${id}.${option}`] = chance;
					}
				}
			}
			const { input_tokens: tokensIn, output_tokens: tokensOut } = result.usage;
			return { answers, usage: { tokensIn, tokensOut } };
		},

		/** Listing the models is the cheapest call that needs a good key: it asks Jev nothing. */
		async checkKey(apiKey) {
			const sdk = clientFor(apiKey);
			try {
				await sdk.models.list();
			} catch (error) {
				report(error);
				throw new JevError(failureOf(error));
			}
		}
	};
}
