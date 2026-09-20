import { describe, expect, it } from 'vitest';
import { createJev } from './real';

const traits = [
	{ id: 'a', name: 'a', question: 'Is it a?', yes: 'It is.', no: 'It is not.' },
	{ id: 'b', name: 'b', question: 'Is it b?' }
];

/** A Jev whose network is this function. */
function jevWith(respond: (url: string, body: unknown) => Response) {
	const calls: { url: string; body: unknown; key: string | null }[] = [];
	const jev = createJev({
		retry: { maxRetries: 0 },
		fetch: async (url, init) => {
			const body = init?.body ? JSON.parse(String(init.body)) : undefined;
			calls.push({ url, body, key: new Headers(init?.headers).get('authorization') });
			return respond(url, body);
		}
	});
	return { jev, calls };
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Jev through the SDK', () => {
	it('asks every trait as a yes/no question in one call and returns probabilities and usage', async () => {
		const { jev, calls } = jevWith(() =>
			json({
				model: 'jev',
				answers: { a: { type: 'noul', noul: 0.9 }, b: { type: 'noul', noul: 0.1 } },
				usage: { input_tokens: 120, output_tokens: 4 }
			})
		);
		const result = await jev.ask('the-key', { post: { text: 'made up' } }, traits);

		expect(result).toEqual({ answers: { a: 0.9, b: 0.1 }, usage: { tokensIn: 120, tokensOut: 4 } });
		expect(calls).toHaveLength(1);
		expect(calls[0]!.key).toContain('the-key');
		expect(calls[0]!.body).toMatchObject({
			state: { post: { text: 'made up' } },
			questions: {
				a: {
					type: 'noul',
					instructions: 'Is it a?',
					criteria: { true: 'It is.', false: 'It is not.' }
				},
				b: { type: 'noul', instructions: 'Is it b?' }
			}
		});
	});

	it('asks a trait with options which of them fits, and returns the chance of each under its own name', async () => {
		const kinds = { own: 'Their own.', advert: 'An advert.' };
		const asked = [
			...traits,
			{ id: 'post0', name: 'post 1', question: 'What kind?', options: kinds }
		];
		const { jev, calls } = jevWith(() =>
			json({
				model: 'jev',
				answers: {
					a: { type: 'noul', noul: 0.9 },
					b: { type: 'noul', noul: 0.1 },
					post0: {
						type: 'choice',
						choice: 'advert',
						confidence: 0.8,
						probabilities: { own: 0.1, advert: 0.9 }
					}
				},
				usage: { input_tokens: 200, output_tokens: 9 }
			})
		);
		const result = await jev.ask('the-key', { posts: ['made up'] }, asked);
		expect(result.answers).toEqual({ a: 0.9, b: 0.1, 'post0.own': 0.1, 'post0.advert': 0.9 });
		expect(calls[0]!.body).toMatchObject({
			questions: { post0: { type: 'choice', instructions: 'What kind?', criteria: kinds } }
		});
	});

	it('takes a choice with an option left out as no answer, and not as a zero for it', async () => {
		const options = { own: 'Own.', advert: 'An advert.' };
		const asked = [{ id: 'post0', name: 'post 1', question: 'What kind?', options }];
		const { jev } = jevWith(() =>
			json({
				model: 'jev',
				answers: {
					post0: { type: 'choice', choice: 'own', confidence: 1, probabilities: { own: 1 } }
				},
				usage: { input_tokens: 1, output_tokens: 1 }
			})
		);
		await expect(jev.ask('k', 'made up', asked)).rejects.toMatchObject({ failure: 'serviceDown' });
	});

	it('takes an answer of another kind than was asked for as no answer', async () => {
		const asked = [
			{ id: 'post0', name: 'post 1', question: 'What kind?', options: { own: 'Own.' } }
		];
		const { jev } = jevWith(() =>
			json({
				model: 'jev',
				answers: { post0: { type: 'noul', noul: 0.9 } },
				usage: { input_tokens: 1, output_tokens: 1 }
			})
		);
		await expect(jev.ask('k', 'made up', asked)).rejects.toMatchObject({ failure: 'serviceDown' });
	});

	it.each([
		[401, 'keyRejected'],
		[403, 'keyRejected'],
		[429, 'tooManyCalls'],
		[503, 'serviceDown']
	])('turns a %d into %s', async (status, failure) => {
		const { jev } = jevWith(() => json({ error: 'no' }, status));
		await expect(jev.checkKey('k')).rejects.toMatchObject({ failure });
	});

	it('turns a dead network into noNetwork, and no key into noKey', async () => {
		const { jev } = jevWith(() => {
			throw new TypeError('fetch failed');
		});
		await expect(jev.checkKey('k')).rejects.toMatchObject({ failure: 'noNetwork' });
		await expect(jev.checkKey('')).rejects.toMatchObject({ failure: 'noKey' });
	});
});
